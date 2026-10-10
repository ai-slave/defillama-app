import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import { chainIconUrl, equityIconUrl, geckoTokenIconUrl, peggedAssetIconUrl, tokenIconUrl } from '~/utils/icons'

type AxisEntityType = NonNullable<ChartConfiguration['axes']['x']['entityType']>

function logoUrlForKey(entityType: AxisEntityType, key: string): string {
	switch (entityType) {
		case 'protocol':
			return tokenIconUrl(key)
		case 'chain':
			return chainIconUrl(key)
		case 'token':
			return geckoTokenIconUrl(key)
		case 'stablecoin':
			return peggedAssetIconUrl(key)
		case 'equity': {
			// key is COUNTRY:TICKER (equity_nk format) or a bare ticker (defaults to US)
			const sep = key.indexOf(':')
			return sep > 0 ? equityIconUrl(key.slice(sep + 1), key.slice(0, sep)) : equityIconUrl(key, 'US')
		}
	}
}

export function buildLogoByCategory(x: ChartConfiguration['axes']['x']): Map<string, string> | undefined {
	const { entityType, logoCategories, logoKeys } = x
	if (!entityType) return undefined
	const map = new Map<string, string>()
	if (logoKeys) {
		for (const label in logoKeys) {
			const key = logoKeys[label]
			if (label && key) map.set(label.toLowerCase(), logoUrlForKey(entityType, key))
		}
	} else if (logoCategories?.length) {
		// legacy persisted configs: logoCategories doubles as both the axis label and the logo key
		for (const v of logoCategories) {
			if (!v) continue
			const label = String(v).toLowerCase()
			if (!map.has(label)) map.set(label, logoUrlForKey(entityType, v))
		}
	}
	return map.size > 0 ? map : undefined
}

export const parseFiniteNumber = (value: unknown): number | null => {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null
	if (typeof value !== 'string' || value.trim() === '') return null
	const parsed = parseFloat(value)
	return Number.isFinite(parsed) ? parsed : null
}

export const parseStringNumber = (value: unknown): number => {
	if (typeof value === 'number') return value
	if (typeof value === 'string') {
		const parsed = parseFloat(value)
		return Number.isNaN(parsed) ? 0 : parsed
	}
	return 0
}

// Query results send date-times without a zone (2026-09-01T00:00:00). Date.parse reads
// those as viewer-local time, which moves points across days and periods; chart data is UTC.
export const parseChartDateMs = (value: string): number =>
	Date.parse(/^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(value) ? `${value}Z` : value)
