export type WeightedGroup = { value: string; weight: number }
export type RWAParentPlatform = string | null | undefined
export const UNKNOWN_PLATFORM = 'Unknown'

export const toUniqueNonEmptyValues = (values: Array<string> | null | undefined): string[] => {
	if (!values || values.length === 0) return []
	const out = new Set<string>()
	for (const value of values) {
		const normalized = typeof value === 'string' ? value.trim() : ''
		if (!normalized) continue
		out.add(normalized)
	}
	return Array.from(out)
}

export const computeWeightedGroups = (values: Array<string> | null | undefined): WeightedGroup[] => {
	const groups = toUniqueNonEmptyValues(values)
	if (groups.length === 0) return []
	const weight = 1 / groups.length
	return groups.map((value) => ({ value, weight }))
}

export const getPrimaryRwaCategory = (values: Array<string> | null | undefined): string | null => {
	return toUniqueNonEmptyValues(values)[0] ?? null
}

export const getRwaPlatforms = (value: RWAParentPlatform): [string] => {
	const platform = value?.trim()
	return platform ? [platform] : [UNKNOWN_PLATFORM]
}
