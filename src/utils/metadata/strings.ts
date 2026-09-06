export function dedupeNonEmpty(values: Array<string>): Array<string> {
	const seen = new Set<string>()
	for (const value of values) {
		if (!value) continue
		seen.add(value)
	}
	return [...seen]
}
