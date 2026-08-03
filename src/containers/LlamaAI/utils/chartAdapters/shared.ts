import { CHART_COLORS } from '~/constants/colors'
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
	return map.size ? map : undefined
}

export const getChartColor = (seriesIndex: number): string =>
	CHART_COLORS[seriesIndex % CHART_COLORS.length] ?? CHART_COLORS[0]

export const parseStringNumber = (value: unknown): number => {
	if (typeof value === 'number') return value
	if (typeof value === 'string') {
		const parsed = parseFloat(value)
		return Number.isNaN(parsed) ? 0 : parsed
	}
	return 0
}
