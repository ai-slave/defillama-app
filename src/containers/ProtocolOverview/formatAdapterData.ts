import type { IAdapterProtocolMetrics } from '~/containers/AdapterMetrics/api.types'
import { definitions } from '~/public/definitions'
import type { IProtocolOverviewPageData } from './types'

type AdapterOverview = NonNullable<IProtocolOverviewPageData['fees']>
type AdapterChainBreakdown = NonNullable<AdapterOverview['chainBreakdown']>

export function getAdapterMethodology(methodology: IAdapterProtocolMetrics['methodology'], key: string): string | null {
	if (typeof methodology === 'string') return methodology
	return methodology?.[key] ?? null
}

const commonMethodology: Readonly<Record<string, string>> = {
	dexs: definitions.dexs.common,
	dexsNotionalVolume: definitions.dexsNotional.common,
	dexAggregators: definitions.dexAggregators.common,
	perps: definitions.perps.common,
	perpsAggregators: definitions.perpsAggregators.common,
	bridgeAggregators: definitions.bridgeAggregators.common,
	optionsPremiumVolume: definitions.optionsPremium.common,
	optionsNotionalVolume: definitions.optionsNotional.common,
	LiquidationVolume: definitions.liquidationVolume.common,
	CollateralLiquidated: definitions.collateralLiquidated.common
}

type AdapterDataOptions = {
	data: IAdapterProtocolMetrics
	methodologyKey?: string
}

type NullableAdapterDataOptions = {
	data: IAdapterProtocolMetrics | null | undefined
	methodologyKey?: string
}

export function formatAdapterData(options: AdapterDataOptions): AdapterOverview
export function formatAdapterData(options: NullableAdapterDataOptions): AdapterOverview | null
export function formatAdapterData({ data, methodologyKey }: NullableAdapterDataOptions): AdapterOverview | null {
	if (!data) {
		return null
	}

	let chainBreakdown: AdapterChainBreakdown | null = null
	if (data.chainBreakdown) {
		const slim: AdapterChainBreakdown = {}
		let hasChainBreakdown = false
		for (const chain in data.chainBreakdown) {
			const value = data.chainBreakdown[chain]
			if (value === undefined) continue
			hasChainBreakdown = true
			slim[chain] = {
				total24h: value.total24h ?? null,
				total7d: value.total7d ?? null,
				total30d: value.total30d ?? null,
				totalAllTime: value.totalAllTime ?? null
			}
		}
		chainBreakdown = hasChainBreakdown ? slim : null
	}

	if (data.childProtocols?.length) {
		const childMethodologies: NonNullable<AdapterOverview['childMethodologies']> = []
		for (const childProtocol of data.childProtocols) {
			if (methodologyKey && !commonMethodology[methodologyKey]) {
				childMethodologies.push({
					id: childProtocol.defillamaId,
					name: childProtocol.displayName,
					methodology: getAdapterMethodology(childProtocol.methodology, methodologyKey),
					methodologyURL: childProtocol.methodologyURL ?? null
				})
			}
		}

		const areMethodologiesDifferent = new Set(childMethodologies.map((entry) => entry.methodology)).size > 1
		const topChildMethodology =
			data.childProtocols.length > 1
				? childMethodologies.find((entry) => entry.name === data.childProtocols?.[0]?.displayName)
				: null

		return {
			total24h: data.total24h ?? null,
			total7d: data.total7d ?? null,
			total30d: data.total30d ?? null,
			total1y: data.total1y ?? null,
			annualized1y: data.annualized1y ?? null,
			totalAllTime: data.totalAllTime ?? null,
			...(areMethodologiesDifferent
				? { childMethodologies: childMethodologies.filter((entry) => !!(entry.methodology || entry.methodologyURL)) }
				: {
						methodology: methodologyKey
							? (topChildMethodology?.methodology ?? commonMethodology[methodologyKey] ?? null)
							: null,
						methodologyURL: topChildMethodology?.methodologyURL ?? null
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
			? (getAdapterMethodology(data.methodology, methodologyKey) ?? commonMethodology[methodologyKey] ?? null)
			: null,
		methodologyURL: data.methodologyURL ?? null,
		defaultChartView: data.defaultChartView ?? 'daily',
		chainBreakdown
	}
}
