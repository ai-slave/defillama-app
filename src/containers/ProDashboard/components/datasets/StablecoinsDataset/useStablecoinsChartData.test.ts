import { describe, expect, it } from 'vitest'
import {
	buildStablecoinOverviewChartData,
	getTopStablecoinFromCollectedValues,
	STABLECOIN_BREAKDOWN_SERIES_LIMIT
} from '~/containers/Stablecoins/chartSeries'
import { buildProStablecoinOverviewPayload } from './useStablecoinsChartData'

const assetNames = Array.from({ length: STABLECOIN_BREAKDOWN_SERIES_LIMIT + 2 }, (_, index) => `TOKEN_${index}`)
const params = {
	chartDataByAssetOrChain: assetNames.map((_, index) => [
		{ date: 1_600_000_000, mcap: { peggedUSD: 100 - index } },
		{ date: 1_600_086_400, mcap: { peggedUSD: 200 - index } }
	]),
	assetsOrChainsList: assetNames,
	filteredIndexes: assetNames.map((_, index) => index),
	issuanceType: 'mcap' as const,
	selectedChain: 'All'
}
const chartData = buildStablecoinOverviewChartData(params, 'tokenMcaps')
const topToken = getTopStablecoinFromCollectedValues(chartData)

describe('buildProStablecoinOverviewPayload', () => {
	it('bounds the default null selection and aggregates the remaining assets', () => {
		const result = buildProStablecoinOverviewPayload(params, 'tokenMcaps', topToken, chartData, null)

		expect(result.defaultSeries).toEqual(assetNames.slice(0, STABLECOIN_BREAKDOWN_SERIES_LIMIT))
		expect(result.charts.map((chart) => chart.name)).toEqual([
			...assetNames.slice(0, STABLECOIN_BREAKDOWN_SERIES_LIMIT),
			'Others'
		])
		expect(result.dataset.source.at(-1)?.Others).toBe(379)
	})

	it('keeps an explicit asset outside the default top set selectable', () => {
		const selectedName = assetNames.at(-1)!
		const result = buildProStablecoinOverviewPayload(params, 'tokenMcaps', topToken, chartData, [selectedName])

		expect(result.availableSeries).toContain(selectedName)
		expect(result.defaultSeries).toEqual(assetNames.slice(0, STABLECOIN_BREAKDOWN_SERIES_LIMIT))
		expect(result.charts.map((chart) => chart.name)).toEqual([selectedName, 'Others'])
		expect(result.dataset.source.at(-1)?.[selectedName]).toBe(189)
		expect(result.dataset.source.at(-1)?.Others).toBe(2_145)
	})
})
