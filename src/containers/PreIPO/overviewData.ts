import type { PreIpoCompanyListItem } from './api.types'

export function filterPreIpoCompanies(
	companies: Array<PreIpoCompanyListItem>,
	searchValue: string,
	sectorFilter: ReadonlySet<string> | null
): Array<PreIpoCompanyListItem> {
	const search = searchValue.trim().toLowerCase()
	if (!search && sectorFilter == null) return companies

	const filtered: Array<PreIpoCompanyListItem> = []
	for (const company of companies) {
		if (sectorFilter != null && !sectorFilter.has(company.sector)) continue
		if (
			search &&
			!company.name.toLowerCase().includes(search) &&
			!company.id.toLowerCase().includes(search) &&
			!company.sector.toLowerCase().includes(search)
		) {
			continue
		}
		filtered.push(company)
	}
	return filtered
}

export function getPreIpoSectors(companies: Array<PreIpoCompanyListItem>): Array<string> {
	const sectors = new Set<string>()
	for (const company of companies) sectors.add(company.sector)
	return Array.from(sectors).sort((a, b) => a.localeCompare(b))
}
