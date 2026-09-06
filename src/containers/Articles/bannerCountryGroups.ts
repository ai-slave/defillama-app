import { EU_COUNTRY_CODES, ISO_COUNTRY_CODES, countryDisplayName } from '~/utils/countries'

export const BANNER_COUNTRY_GROUPS = [
	{
		id: 'eu',
		label: 'European Union',
		description: 'All 27 EU member countries',
		countries: EU_COUNTRY_CODES
	}
] as const

export type BannerCountryGroupId = (typeof BANNER_COUNTRY_GROUPS)[number]['id']

export const BANNER_COUNTRY_OPTIONS = ISO_COUNTRY_CODES.map((country) => ({
	value: country,
	label: countryDisplayName(country),
	selectedLabel: country
})).sort((left, right) => left.label.localeCompare(right.label))

export function expandBannerCountrySelection(
	groups: Array<BannerCountryGroupId>,
	countries: Array<string>
): Array<string> {
	const expanded = new Set(countries.map((country) => country.trim().toUpperCase()).filter(Boolean))
	for (const group of BANNER_COUNTRY_GROUPS) {
		if (!groups.includes(group.id)) continue
		for (const country of group.countries) expanded.add(country)
	}
	return Array.from(expanded)
}

export function collapseBannerCountrySelection(targetCountries: Array<string>): {
	groups: Array<BannerCountryGroupId>
	countries: Array<string>
} {
	const remaining = new Set(targetCountries.map((country) => country.trim().toUpperCase()).filter(Boolean))
	const groups: Array<BannerCountryGroupId> = []

	for (const group of BANNER_COUNTRY_GROUPS) {
		if (!group.countries.every((country) => remaining.has(country))) continue
		groups.push(group.id)
		for (const country of group.countries) remaining.delete(country)
	}

	return { groups, countries: Array.from(remaining) }
}

export function bannerAudienceLabel(targetCountries: Array<string> | null | undefined): string {
	if (!targetCountries?.length) return 'Global audience'
	const selection = collapseBannerCountrySelection(targetCountries)
	const labels = selection.groups.map(
		(groupId) => BANNER_COUNTRY_GROUPS.find((group) => group.id === groupId)?.label ?? groupId.toUpperCase()
	)
	labels.push(...selection.countries.slice(0, 2).map(countryDisplayName))
	const representedCount = expandBannerCountrySelection(selection.groups, selection.countries.slice(0, 2)).length
	const remainingCount = targetCountries.length - representedCount
	return remainingCount > 0 ? `${labels.join(' + ')} + ${remainingCount} more` : labels.join(' + ')
}
