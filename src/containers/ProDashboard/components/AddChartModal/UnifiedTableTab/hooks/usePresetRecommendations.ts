import { useMemo } from 'react'
import { UNIFIED_TABLE_PRESETS_BY_ID } from '~/containers/ProDashboard/components/UnifiedTable/config/PresetRegistry'
import type { UnifiedTableFilters } from '~/containers/ProDashboard/unifiedTable/config/current'

interface UsePresetRecommendationsProps {
	filters: UnifiedTableFilters
	chains: string[]
}

export function usePresetRecommendations({ filters, chains }: UsePresetRecommendationsProps) {
	return useMemo(() => {
		const ids = new Set<string>()
		const addPreset = (presetId: string) => {
			const preset = UNIFIED_TABLE_PRESETS_BY_ID.get(presetId)
			if (!preset) return
			ids.add(presetId)
		}

		const normalizeValue = (value: string) => value.trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')

		const includeCategories = filters.categories ?? []
		const excludeCategories = filters.excludedCategories ?? []
		const combinedCategories = [...includeCategories, ...excludeCategories].map(normalizeValue)
		const normalizedCategorySet = new Set(combinedCategories)

		const protocolFilters = filters.protocols ?? []
		const normalizedProtocols = protocolFilters.map(normalizeValue)

		const normalizedChains = chains.map(normalizeValue)

		const hasOracles = Boolean(filters.oracles?.length)

		const CATEGORY_PRESET_MAP: Record<string, string[]> = {
			dexs: ['volume-protocols'],
			'dex aggregator': ['aggregators-protocols'],
			options: ['options-protocols'],
			'exotic options': ['options-protocols'],
			'options vault': ['options-protocols'],
			derivatives: ['perps-protocols'],
			perps: ['perps-protocols'],
			bridge: ['bridge-aggregators-protocols'],
			'bridge aggregator': ['bridge-aggregators-protocols'],
			'cross chain bridge': ['bridge-aggregators-protocols'],
			yield: ['revenue-protocols'],
			'yield aggregator': ['revenue-protocols'],
			'yield lottery': ['revenue-protocols'],
			'liquid staking': ['revenue-protocols'],
			'liquid restaking': ['revenue-protocols'],
			restaking: ['revenue-protocols'],
			lending: ['fees-protocols', 'revenue-protocols'],
			'uncollateralized lending': ['fees-protocols', 'revenue-protocols'],
			cdp: ['revenue-protocols'],
			'cdp manager': ['revenue-protocols'],
			'stablecoin issuer': ['revenue-protocols'],
			rwa: ['revenue-protocols'],
			'rwa lending': ['revenue-protocols'],
			synthetics: ['growth-protocols'],
			'leveraged farming': ['growth-protocols'],
			farm: ['growth-protocols'],
			insurance: ['revenue-protocols'],
			mev: ['growth-protocols'],
			oracle: ['perps-protocols']
		}

		const PROTOCOL_KEYWORD_PRESETS: Array<{ keywords: string[]; presets: string[] }> = [
			{
				keywords: ['uniswap', 'sushi', 'balancer', 'curve', 'pancake', 'raydium', 'spooky'],
				presets: ['volume-protocols']
			},
			{
				keywords: ['gmx', 'dydx', 'perp', 'perpetual', 'kwenta', 'hyperliquid', 'polynomial'],
				presets: ['perps-protocols']
			},
			{
				keywords: ['lyra', 'dopex', 'premia', 'aevo', 'ribbon', 'hemera', 'zeta'],
				presets: ['options-protocols']
			},
			{
				keywords: ['1inch', 'paraswap', 'matcha', 'rubic', 'lifi', 'zapper', 'metafi'],
				presets: ['aggregators-protocols']
			},
			{
				keywords: ['stargate', 'synapse', 'across', 'wormhole', 'hop', 'debridge'],
				presets: ['bridge-aggregators-protocols']
			},
			{
				keywords: ['maker', 'aave', 'compound', 'frax', 'liquity', 'spark', 'morpho'],
				presets: ['revenue-protocols', 'fees-protocols']
			}
		]

		addPreset('essential-protocols')
		addPreset('growth-protocols')
		addPreset('fees-protocols')
		addPreset('revenue-protocols')

		for (const categoryValue of combinedCategories) {
			for (const [matchKey, presets] of Object.entries(CATEGORY_PRESET_MAP)) {
				if (categoryValue.includes(matchKey)) {
					for (const preset of presets) {
						addPreset(preset)
					}
				}
			}
		}

		for (const { keywords, presets } of PROTOCOL_KEYWORD_PRESETS) {
			if (keywords.some((keyword) => normalizedProtocols.some((protocol) => protocol.includes(keyword)))) {
				for (const preset of presets) {
					addPreset(preset)
				}
			}
		}

		if (normalizedCategorySet.has('dex aggregator')) {
			addPreset('aggregators-protocols')
		}

		if (normalizedCategorySet.has('options') || normalizedCategorySet.has('exotic options')) {
			addPreset('options-protocols')
		}

		if (normalizedCategorySet.has('bridge aggregator')) {
			addPreset('bridge-aggregators-protocols')
		}

		if (normalizedCategorySet.has('oracle') || hasOracles) {
			addPreset('perps-protocols')
		}

		if (normalizedChains.some((value) => value !== 'all')) {
			addPreset('volume-protocols')
			addPreset('revenue-protocols')
		}

		return Array.from(ids).filter((id) => {
			const preset = UNIFIED_TABLE_PRESETS_BY_ID.get(id)
			return Boolean(preset)
		})
	}, [filters.categories, filters.excludedCategories, filters.protocols, filters.oracles, chains])
}
