import type { ChainChartResponse } from '~/containers/Chains/api.types'
import { TVL_SETTINGS_KEYS } from '~/contexts/LocalStorage'
import { getPercentChange } from '~/utils'
import { applyTvlOverlapBaseAdjustment } from '~/utils/tvl'
import { getPrevTvlFromChart } from '~/utils/tvlChart'
import { shouldSubtractTvlOverlapSeries } from '~/utils/tvlOverlap'
import type { IChainOverviewData } from './types'

interface ChainTvlChartSummary {
	totalValueUSD: number | null
	tvlPrevDay: number | null
	valueChange24hUSD: number | null
	change24h: number | null
}

type ChainTvlExtraCharts = Record<string, Record<string, number> | undefined>

export function applyChainTvlChartSettings({
	tvlChart,
	extraTvlCharts,
	tvlSettings
}: {
	tvlChart: Array<[number, number]>
	extraTvlCharts: ChainTvlExtraCharts
	tvlSettings: Record<string, boolean>
}): { finalTvlChart: Array<[number, number]>; isGovTokensEnabled: boolean } | null {
	const toggledTvlSettings = TVL_SETTINGS_KEYS.filter((key) => tvlSettings[key])

	if (toggledTvlSettings.length === 0) {
		return null
	}

	const finalTvlChart: Array<[number, number]> = []
	const shouldSubtractOverlap = shouldSubtractTvlOverlapSeries(toggledTvlSettings)

	// Chain chart API series are chronological, so keep this hot path one-pass.
	for (const [date, tvl] of tvlChart) {
		let sum = tvl
		for (const toggledTvlSetting of toggledTvlSettings) {
			sum += extraTvlCharts[toggledTvlSetting]?.[date] ?? 0
		}
		if (shouldSubtractOverlap) {
			sum -= extraTvlCharts.dcAndLsOverlap?.[date] ?? 0
		}
		finalTvlChart.push([date, sum])
	}

	return { finalTvlChart, isGovTokensEnabled: !!tvlSettings.govtokens }
}

export function buildChainTvlChartState({
	tvlChart,
	tvlChartSummary,
	extraTvlCharts,
	tvlSettings,
	nowMs
}: {
	tvlChart: Array<[number, number]>
	tvlChartSummary: ChainTvlChartSummary
	/** Null until the settings series load, or when they fail: TVL stays the default the page was built with. */
	extraTvlCharts: Record<string, Record<string, number>> | null
	tvlSettings: Record<string, boolean>
	nowMs: number
}): {
	finalTvlChart: Array<[number, number]>
	totalValueUSD: number | null
	valueChange24hUSD: number | null
	change24h: number | null
	isGovTokensEnabled?: boolean
} {
	const chartWithSettings = extraTvlCharts
		? applyChainTvlChartSettings({ tvlChart, extraTvlCharts, tvlSettings })
		: null

	if (!chartWithSettings) {
		return {
			finalTvlChart: tvlChart,
			totalValueUSD: tvlChartSummary.totalValueUSD,
			valueChange24hUSD: tvlChartSummary.valueChange24hUSD,
			change24h: tvlChartSummary.change24h
		}
	}

	const { finalTvlChart, isGovTokensEnabled } = chartWithSettings

	const totalValueUSD = getPrevTvlFromChart(finalTvlChart, 0, nowMs)
	const tvlPrevDay = getPrevTvlFromChart(finalTvlChart, 1, nowMs)
	const valueChange24hUSD = totalValueUSD != null && tvlPrevDay != null ? totalValueUSD - tvlPrevDay : null
	const change24h = totalValueUSD != null && tvlPrevDay != null ? getPercentChange(totalValueUSD, tvlPrevDay) : null

	return { finalTvlChart, totalValueUSD, valueChange24hUSD, change24h, isGovTokensEnabled }
}

function formatExtraTvlChart(chart: ChainChartResponse['tvl'] = []): Record<string, number> {
	const formatted: Record<string, number> = {}
	for (const [date, totalLiquidityUSD] of chart) {
		formatted[Number(date) * 1e3] = Math.trunc(totalLiquidityUSD)
	}
	return formatted
}

/** The default TVL chart and the TVL setting series that toggles add or subtract, keyed by ms date, from one chain
    chart response. Both come from the same response, so a toggled TVL never mixes two snapshots. */
export function buildChainTvlCharts(
	chartData: ChainChartResponse
): Pick<IChainOverviewData, 'tvlChart' | 'extraTvlCharts'> {
	const extraTvlCharts = {
		staking: formatExtraTvlChart(chartData.staking),
		borrowed: formatExtraTvlChart(chartData.borrowed),
		pool2: formatExtraTvlChart(chartData.pool2),
		vesting: formatExtraTvlChart(chartData.vesting),
		offers: formatExtraTvlChart(chartData.offers),
		doublecounted: formatExtraTvlChart(chartData.doublecounted),
		liquidstaking: formatExtraTvlChart(chartData.liquidstaking),
		dcAndLsOverlap: formatExtraTvlChart(chartData.dcAndLsOverlap)
	}
	// The default leaves liquid staking and double counted TVL out, but adds their overlap back so it is not
	// subtracted twice.
	const tvlChart: Array<[number, number]> = []
	for (const [date, totalLiquidityUSD] of chartData.tvl ?? []) {
		const timestamp = Number(date) * 1e3
		const sum = applyTvlOverlapBaseAdjustment(Math.trunc(totalLiquidityUSD), {
			liquidstaking: extraTvlCharts.liquidstaking[timestamp],
			doublecounted: extraTvlCharts.doublecounted[timestamp],
			dcAndLsOverlap: extraTvlCharts.dcAndLsOverlap[timestamp]
		})
		tvlChart.push([timestamp, sum])
	}
	return { tvlChart, extraTvlCharts }
}
