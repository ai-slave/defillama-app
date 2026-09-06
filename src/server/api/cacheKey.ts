export function normalizeCacheList(
	values: ReadonlyArray<string>,
	options: { lowercase?: boolean } = {}
): Array<string> {
	const normalizedValues = new Set<string>()

	for (const value of values) {
		const trimmed = value.trim()
		if (!trimmed) continue

		normalizedValues.add(options.lowercase ? trimmed.toLowerCase() : trimmed)
	}

	return Array.from(normalizedValues).sort((left, right) => left.localeCompare(right))
}

export function stableCacheKey(parts: ReadonlyArray<unknown>): string {
	return JSON.stringify(parts)
}
