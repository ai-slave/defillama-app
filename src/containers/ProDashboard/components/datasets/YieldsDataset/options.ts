import type { ProYieldRow } from '../../../yieldData'

export interface YieldsFilterOptions {
	availableTokens: Array<string>
	availableProtocols: Array<{ value: string; label: string }>
	availableCategories: Array<string>
}

export type YieldsFilterSourceRow = Pick<ProYieldRow, 'project' | 'projectslug' | 'tvl' | 'tokenSymbols' | 'category'>

export function buildYieldsFilterOptions(data: ReadonlyArray<YieldsFilterSourceRow>): YieldsFilterOptions {
	const tokenTvl = new Map<string, number>()
	const protocols = new Map<string, { value: string; label: string; tvl: number }>()
	const categories = new Set<string>()

	for (const row of data) {
		const tvl = row.tvl ?? 0
		for (const token of row.tokenSymbols) tokenTvl.set(token, (tokenTvl.get(token) ?? 0) + tvl)

		const slug = (row.projectslug || row.project || '').trim()
		const name = (row.project || '').trim()
		if (slug || name) {
			const key = (slug || name).toLowerCase()
			const existing = protocols.get(key)
			if (existing) {
				existing.tvl += tvl
				if (!existing.label && name) existing.label = name
				if (!existing.value && slug) existing.value = slug
			} else {
				protocols.set(key, { value: slug || name, label: name || slug, tvl })
			}
		}

		if (row.category) categories.add(row.category)
	}

	return {
		availableTokens: Array.from(tokenTvl.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([token]) => token),
		availableProtocols: Array.from(protocols.values())
			.sort((a, b) => (b.tvl !== a.tvl ? b.tvl - a.tvl : a.label.localeCompare(b.label)))
			.map(({ value, label }) => ({ value, label })),
		availableCategories: Array.from(categories).sort()
	}
}
