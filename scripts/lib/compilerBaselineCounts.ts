/** Pure count and ratchet helpers for the React Compiler bailout baseline. */

/** reason -> file -> number of bailouts */
export type Counts = Record<string, Record<string, number>>

function sortedKeys(record: Record<string, unknown>): Array<string> {
	return Object.keys(record).sort()
}

/**
 * The committed sidecar is file-major with one line per file, so fixing a file changes one line and the
 * file stays as small as the number of files with debt.
 */
export function renderCounts(counts: Counts): string {
	const byFile: Record<string, Record<string, number>> = {}
	for (const rule in counts) {
		for (const file in counts[rule]) (byFile[file] ??= {})[rule] = counts[rule][file]
	}
	const lines = sortedKeys(byFile).map((file) => {
		const rules: Record<string, number> = {}
		for (const rule of sortedKeys(byFile[file])) rules[rule] = byFile[file][rule]
		return `\t${JSON.stringify(file)}: ${JSON.stringify(rules)}`
	})
	return `{\n${lines.join(',\n')}\n}\n`
}

export function parseCounts(text: string): Counts {
	const byFile = JSON.parse(text) as Record<string, Record<string, number>>
	const counts: Counts = {}
	for (const file in byFile) {
		for (const rule in byFile[file]) (counts[rule] ??= {})[file] = byFile[file][rule]
	}
	return counts
}

/**
 * Entries where `head` accepts more debt than `base`: a rule/file pair that is new, or whose count went
 * up. Used for the committed baseline against its target branch and current bailouts against
 * the committed baseline.
 */
export function findGrowth(base: Counts, head: Counts): Array<string> {
	const grown: Array<string> = []
	for (const rule of sortedKeys(head)) {
		for (const file of sortedKeys(head[rule])) {
			const before = base[rule]?.[file] ?? 0
			const after = head[rule][file]
			if (after > before) grown.push(`${rule}  ${file}  ${before} -> ${after}`)
		}
	}
	return grown
}

/** Entries in `committed` that `fresh` no longer needs, fully or partly. */
export function findStale(committed: Counts, fresh: Counts): Array<string> {
	const stale: Array<string> = []
	for (const rule of sortedKeys(committed)) {
		for (const file of sortedKeys(committed[rule])) {
			const before = committed[rule][file]
			const after = fresh[rule]?.[file] ?? 0
			if (after < before) stale.push(`${rule}  ${file}  ${before} -> ${after}`)
		}
	}
	return stale
}

export function total(counts: Counts): { rules: number; files: number; violations: number } {
	const files = new Set<string>()
	let violations = 0
	for (const rule in counts) {
		for (const file in counts[rule]) {
			files.add(file)
			violations += counts[rule][file]
		}
	}
	return { rules: Object.keys(counts).length, files: files.size, violations }
}
