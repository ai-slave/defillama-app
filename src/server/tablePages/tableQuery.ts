/**
 * Browser-safe query schema for server-paginated tables.
 *
 * A surface declares its query as a field list; the schema then owns the two
 * operations every table needs to agree on across client and server:
 *
 * - `normalize`: coerce or reject raw input (URL params, POST bodies, router
 *   state) into one canonical query object. `null` means the request is
 *   invalid.
 * - `signature`: serialize the canonical query into one stable string. Two
 *   queries with the same signature MUST produce the same row order — the
 *   signature keys the server's prepared-row cache and is hashed into cursors.
 *
 * Field parsers return `undefined` to reject the whole query, or a value
 * (coerced defaults included) to accept. Keys not declared in `fields` are
 * ignored by both operations, so UI-only state mixed into the same object
 * never changes the signature.
 *
 * This module must stay browser-safe: signatures are plain strings here;
 * hashing them is server-only (see preparedRows.server.ts).
 */

export type TableQueryField<T> = {
	/** Coerce raw input to a value, or return undefined to reject the query. */
	parse: (raw: unknown) => T | undefined
	/** Canonical form used in the signature; defaults to the parsed value. */
	signatureValue?: (value: T) => unknown
}

export type TableQuerySchema<Shape extends Record<string, unknown>> = {
	normalize: (raw: Record<string, unknown>) => Shape | null
	signature: (query: Shape) => string
}

export function defineTableQuery<Shape extends Record<string, unknown>>(spec: {
	fields: { [K in keyof Shape]: TableQueryField<Shape[K]> }
	/** Cross-field rules (e.g. "sort=custom requires a formula"). Return null to reject. */
	refine?: (query: Shape) => Shape | null
}): TableQuerySchema<Shape> {
	const keys = Object.keys(spec.fields) as Array<keyof Shape & string>
	return {
		normalize(raw) {
			const query = {} as Shape
			for (const key of keys) {
				const parsed = spec.fields[key].parse(raw[key])
				if (parsed === undefined) return null
				query[key] = parsed
			}
			return spec.refine ? spec.refine(query) : query
		},
		signature(query) {
			// Re-apply cross-field rules so a caller-built query object (which may
			// bypass normalize) still signs identically to a normalized one.
			const refined = (spec.refine ? spec.refine(query) : null) ?? query
			const canonical: Record<string, unknown> = {}
			for (const key of keys) {
				const field = spec.fields[key]
				canonical[key] = field.signatureValue ? field.signatureValue(refined[key]) : refined[key]
			}
			return JSON.stringify(canonical)
		}
	}
}

/** Free-text input: non-strings coerce to `fallback`, strings are length-capped. */
export function textField(options: {
	maxLength: number
	fallback?: string
	signatureValue?: (value: string) => unknown
}): TableQueryField<string> {
	const fallback = options.fallback ?? ''
	return {
		parse: (raw) => (typeof raw === 'string' ? raw.slice(0, options.maxLength) : fallback),
		...(options.signatureValue ? { signatureValue: options.signatureValue } : {})
	}
}

/** Optional numeric bound: null/undefined stay null, non-finite values reject. */
export function nullableNumberField(): TableQueryField<number | null> {
	return {
		parse: (raw) => {
			if (raw === null || raw === undefined) return null
			return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined
		}
	}
}

/**
 * Closed set of string values. Unmatched input rejects unless a fallback is
 * given: `fallback` absorbs any unmatched value (e.g. order -> 'desc'),
 * `nonStringFallback` absorbs only non-string input while unmatched strings
 * still reject (e.g. sort keys).
 */
export function enumField<T extends string>(
	values: ReadonlyArray<T>,
	options: { fallback?: T; nonStringFallback?: T } = {}
): TableQueryField<T> {
	const allowed = new Set<string>(values)
	return {
		parse: (raw) => {
			if (typeof raw !== 'string') return options.nonStringFallback ?? options.fallback
			return allowed.has(raw) ? (raw as T) : options.fallback
		}
	}
}

/** Deduplicated, sorted list of allowed strings; non-arrays coerce to []. */
export function stringSetField(options: { allow: (value: string) => boolean }): TableQueryField<Array<string>> {
	return {
		parse: (raw) => {
			if (!Array.isArray(raw)) return []
			const filtered = raw.filter((value): value is string => typeof value === 'string' && options.allow(value))
			return [...new Set(filtered)].sort()
		}
	}
}

/** Nested object parsed field-by-field; non-objects coerce to null. */
export function shapeOrNullField<Shape extends Record<string, unknown>>(fields: {
	[K in keyof Shape]: TableQueryField<Shape[K]>
}): TableQueryField<Shape | null> {
	const keys = Object.keys(fields) as Array<keyof Shape & string>
	return {
		parse: (raw) => {
			if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
			const source = raw as Record<string, unknown>
			const value = {} as Shape
			for (const key of keys) {
				const parsed = fields[key].parse(source[key])
				if (parsed === undefined) return undefined
				value[key] = parsed
			}
			return value
		}
	}
}

/**
 * Canonical signature over raw wire params, for surfaces whose filter space is
 * too large to enumerate as a field schema (dozens of established params with
 * battle-tested parsers). Keys are sorted, absent values dropped, and paging
 * params excluded — so every KEY ordering of the same filter set signs
 * identically and every page of it shares one prepared-rows entry. Value ORDER is preserved and empty strings
 * are kept: parsers may read only the first of repeated params (`sortBy`) or
 * distinguish `?x=` from an absent `x`, and aliasing either case would poison
 * the cache, while a distinct signature merely spends a slot. Prefer defineTableQuery for bounded query
 * shapes; this is the escape hatch that keeps existing parsers untouched.
 */
export function canonicalQuerySignature(
	query: Record<string, string | Array<string> | undefined>,
	options: { exclude: ReadonlyArray<string> }
): string {
	const excluded = new Set(options.exclude)
	const entries: Array<[string, Array<string>]> = []
	for (const key of Object.keys(query).sort()) {
		if (excluded.has(key)) continue
		const raw = query[key]
		if (raw === undefined) continue
		entries.push([key, Array.isArray(raw) ? raw : [raw]])
	}
	return JSON.stringify(entries)
}
