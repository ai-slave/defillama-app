export function normalizeCachePath(value: unknown): string | null {
	if (typeof value !== 'string') return null
	const trimmed = value.trim()
	if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('://')) return null
	const path = trimmed.split('#')[0]?.split('?')[0] ?? ''
	return path.startsWith('/') ? path : null
}

export function normalizeCachePaths(values: unknown): Array<string> {
	const input = Array.isArray(values) ? values : []
	const paths = new Set<string>()
	for (const value of input) {
		const path = normalizeCachePath(value)
		if (path) paths.add(path)
	}
	return Array.from(paths).slice(0, 50)
}
