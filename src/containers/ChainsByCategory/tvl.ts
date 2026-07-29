import type { ChainExtraTvlRecord } from '~/containers/Chains/api.types'
import type { TvlSettingsKey } from '~/contexts/LocalStorage'
import { applyTvlOverlapBaseAdjustment } from '~/utils/tvl'
import { shouldSubtractTvlOverlapSeries } from '~/utils/tvlOverlap'

type ChainTvlValue = number | null | undefined
type ChainTvlExtraValues = Partial<Record<TvlSettingsKey | 'dcAndLsOverlap', ChainTvlValue>>
const EXTRA_TVL_STALE_TOLERANCE_MS = 2 * 24 * 60 * 60 * 1000

const getLatestChartTimestamp = (chart: Record<number, number> | undefined): number | null => {
	if (!chart) return null

	let latestTimestamp: number | null = null
	for (const timestamp in chart) {
		const parsedTimestamp = Number(timestamp)
		latestTimestamp = latestTimestamp == null ? parsedTimestamp : Math.max(latestTimestamp, parsedTimestamp)
	}

	return latestTimestamp
}

export function normalizeChainsBaseTvlValue(baseValue: number, extraValues?: ChainTvlExtraValues): number
export function normalizeChainsBaseTvlValue(baseValue: ChainTvlValue, extraValues?: ChainTvlExtraValues): number | null
export function normalizeChainsBaseTvlValue(
	baseValue: ChainTvlValue,
	extraValues: ChainTvlExtraValues = {}
): number | null {
	if (baseValue == null) return null
	for (const key of ['doublecounted', 'liquidstaking', 'dcAndLsOverlap'] as const) {
		if (Object.hasOwn(extraValues, key) && extraValues[key] == null) return null
	}
	return applyTvlOverlapBaseAdjustment(baseValue, extraValues)
}

export function getChainMcapTvlRatio(mcap: number | null, tvl: number | null): number | null {
	return mcap != null && tvl != null && tvl > 0 ? mcap / tvl : null
}

export function applyChainsTvlSettings(
	baseValue: number,
	extraValues: ChainTvlExtraValues,
	enabledSettings: readonly TvlSettingsKey[]
): number
export function applyChainsTvlSettings(
	baseValue: ChainTvlValue,
	extraValues: ChainTvlExtraValues,
	enabledSettings: readonly TvlSettingsKey[]
): number | null
export function applyChainsTvlSettings(
	baseValue: ChainTvlValue,
	extraValues: ChainTvlExtraValues,
	enabledSettings: readonly TvlSettingsKey[]
): number | null {
	if (baseValue == null) return null
	let value = baseValue
	for (const key of enabledSettings) {
		if (!Object.hasOwn(extraValues, key)) continue
		const extraValue = extraValues[key]
		if (extraValue == null) return null
		value += extraValue
	}

	if (shouldSubtractTvlOverlapSeries(enabledSettings) && Object.hasOwn(extraValues, 'dcAndLsOverlap')) {
		const overlapValue = extraValues.dcAndLsOverlap
		if (overlapValue == null) return null
		value -= overlapValue
	}

	return Math.max(0, value)
}

export function removeStaleChainExtraTvlEntries({
	chainName,
	extraTvl,
	tvlChartsByChain
}: {
	chainName: string
	extraTvl: ChainExtraTvlRecord | undefined
	tvlChartsByChain: Record<string, Record<string, Record<number, number>>>
}): ChainExtraTvlRecord {
	const sanitizedExtraTvl: ChainExtraTvlRecord = {}
	if (!extraTvl) return sanitizedExtraTvl

	const baseCharts = tvlChartsByChain.tvl
	const latestBaseTimestamp = getLatestChartTimestamp(baseCharts?.[chainName])
	for (const key in extraTvl) {
		const entry = extraTvl[key]
		if (entry === undefined) continue
		if (latestBaseTimestamp == null || tvlChartsByChain[key] === undefined) {
			sanitizedExtraTvl[key] = entry
			continue
		}

		const extraCharts = tvlChartsByChain[key]
		const latestExtraTimestamp = getLatestChartTimestamp(extraCharts?.[chainName])
		if (latestExtraTimestamp == null) continue
		if (latestBaseTimestamp - latestExtraTimestamp > EXTRA_TVL_STALE_TOLERANCE_MS) continue
		sanitizedExtraTvl[key] = entry
	}

	if (!sanitizedExtraTvl.doublecounted || !sanitizedExtraTvl.liquidstaking) {
		delete sanitizedExtraTvl.dcAndLsOverlap
	}

	return sanitizedExtraTvl
}
