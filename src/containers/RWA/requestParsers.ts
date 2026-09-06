export function parseEnumQueryValue<T extends string>(
	value: string | Array<string> | undefined,
	allowedValues: ReadonlyArray<T>
): T | null {
	if (Array.isArray(value) || value == null) return null
	return allowedValues.includes(value as T) ? (value as T) : null
}

export function parseBooleanQueryFlag(
	value: string | Array<string> | undefined,
	defaultValue?: boolean
): boolean | null {
	if (value == null) return defaultValue ?? null
	if (Array.isArray(value)) return null
	if (value === 'true') return true
	if (value === 'false') return false
	return null
}

export function parseOptionalStringTarget(value: string | Array<string> | undefined): string | null | undefined {
	if (value == null) return undefined
	if (Array.isArray(value)) return null
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}

export function hasExactlyOneTarget(values: Array<string | undefined>): boolean {
	let count = 0
	for (const value of values) {
		if (value) count++
	}
	return count === 1
}
