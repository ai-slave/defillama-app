import type { IAdapterProtocolMetrics } from '~/containers/AdapterMetrics/api.types'
import { definitions } from '~/public/definitions'
import type { IProtocolOverviewPageData } from './types'

type AdapterOverview = NonNullable<IProtocolOverviewPageData['fees']>
type AdapterChainBreakdown = NonNullable<AdapterOverview['chainBreakdown']>

function getMethodology(methodology: IAdapterProtocolMetrics['methodology'], key: string): string | null {
	if (typeof methodology === 'string') return methodology
	return methodology?.[key] ?? null
}

const commonMethodology = {
	dexs: definitions.dexs.common,
	dexsNotionalVolume: definitions.dexsNotional.common,
	dexAggregators: definitions.dexAggregators.common,
	perps: definitions.perps.common,
	perpsAggregators: definitions.perpsAggregators.common,
	bridgeAggregators: definitions.bridgeAggregators.common,
	optionsPremiumVolume: definitions.optionsPremium.common,
	optionsNotionalVolume: definitions.optionsNotional.common,
	liquidationVolume: definitions.liquidationVolume.common,
	collateralLiquidated: definitions.collateralLiquidated.common
}

export function formatAdapterData({
	data,
	methodologyKey
}: {
	data: IAdapterProtocolMetrics | null | undefined
	methodologyKey?: string
}): AdapterOverview | null {
	if (!data) {
		return null
	}

	let chainBreakdown: AdapterChainBreakdown | null = null
	if (data.chainBreakdown) {
		const slim: AdapterChainBreakdown = {}
		for (const chain in data.chainBreakdown) {
			const value = data.chainBreakdown[chain]
			if (value === undefined) continue
			slim[chain] = {
				total24h: value.total24h ?? null,
				total7d: value.total7d ?? null,
				total30d: value.total30d ?? null,
				totalAllTime: value.totalAllTime ?? null
			}
		}
		chainBreakdown = Object.keys(slim).length === 0 ? null : slim
	}

	const commonMethodologyMap = commonMethodology as Record<string, string>

	if (data.childProtocols?.length) {
		const childMethodologies: Array<[string, string | null, string | null]> = []
		for (const childProtocol of data.childProtocols) {
			if (methodologyKey && !commonMethodologyMap[methodologyKey]) {
				childMethodologies.push([
					childProtocol.displayName,
					getMethodology(childProtocol.methodology, methodologyKey),
					childProtocol.methodologyURL ?? null
				])
			}
		}

		const areMethodologiesDifferent = new Set(childMethodologies.map((entry) => entry[1])).size > 1
		const topChildMethodology =
			data.childProtocols.length > 1
				? childMethodologies.find((entry) => entry[0] === data.childProtocols?.[0]?.displayName)
				: null

		return {
			total24h: data.total24h ?? null,
			total7d: data.total7d ?? null,
			total30d: data.total30d ?? null,
			total1y: data.total1y ?? null,
			annualized1y: data.annualized1y ?? null,
			totalAllTime: data.totalAllTime ?? null,
			...(areMethodologiesDifferent
				? { childMethodologies: childMethodologies.filter((entry) => !!(entry[1] || entry[2])) }
				: {
						methodology: methodologyKey
							? (topChildMethodology?.[1] ?? commonMethodologyMap[methodologyKey] ?? null)
							: null,
						methodologyURL: topChildMethodology?.[2] ?? null
					}),
			defaultChartView: data.defaultChartView ?? 'daily',
			chainBreakdown
		}
	}

	return {
		total24h: data.total24h ?? null,
		total7d: data.total7d ?? null,
		total30d: data.total30d ?? null,
		total1y: data.total1y ?? null,
		annualized1y: data.annualized1y ?? null,
		totalAllTime: data.totalAllTime ?? null,
		methodology: methodologyKey
			? (getMethodology(data.methodology, methodologyKey) ?? commonMethodologyMap[methodologyKey] ?? null)
			: null,
		methodologyURL: data.methodologyURL ?? null,
		defaultChartView: data.defaultChartView ?? 'daily',
		chainBreakdown
	}
}
