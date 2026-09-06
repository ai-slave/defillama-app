import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { LiquidationsDistributionChartData } from '../api.types'
import {
	buildLiquidationsChartExportDataset,
	buildCumulativeLiquidationsChartView,
	getLiquidationsChartBreakdownMode,
	getLiquidationsChartBreakdownQueryPatch,
	getLiquidationsChartMetric,
	getLiquidationsChartMetricQueryPatch,
	getLiquidationsChartMode,
	getLiquidationsChartModeQueryPatch,
	getLiquidationsChartTokenQueryPatch,
	getLiquidationsChartView,
	LiquidationsDistributionChartFooter,
	resolveLiquidationsChartTokenKey
} from '../LiquidationsDistributionChart'

const chart: LiquidationsDistributionChartData = {
	tokens: [
		{
			key: 'WBTC',
			label: 'WBTC',
			totalUsd: 60,
			breakdowns: {
				total: {
					bins: [0, 10, 20],
					series: [
						{
							key: 'WBTC',
							label: 'WBTC',
							usd: [10, 20, 30],
							amount: [1, 2, 3],
							totalUsd: 60
						}
					]
				},
				protocol: {
					bins: [0, 10, 20],
					series: [
						{
							key: 'Aave',
							label: 'Aave',
							usd: [10, 20, 30],
							amount: [1, 2, 3],
							totalUsd: 60
						}
					]
				},
				chain: {
					bins: [0, 10, 20],
					series: [
						{
							key: 'Ethereum',
							label: 'Ethereum',
							usd: [10, 20, 30],
							amount: [1, 2, 3],
							totalUsd: 60
						}
					]
				}
			}
		},
		{
			key: 'ethereum:eth',
			label: 'ethereum:eth',
			totalUsd: 30,
			breakdowns: {
				total: {
					bins: [0, 10, 20],
					series: [
						{
							key: 'ethereum:eth',
							label: 'ethereum:eth',
							usd: [5, 10, 15],
							amount: [0.5, 1, 1.5],
							totalUsd: 30
						}
					]
				},
				protocol: {
					bins: [0, 10, 20],
					series: [
						{
							key: 'Sky',
							label: 'Sky',
							usd: [5, 10, 15],
							amount: [0.5, 1, 1.5],
							totalUsd: 30
						}
					]
				},
				chain: {
					bins: [0, 10, 20],
					series: [
						{
							key: 'Ethereum',
							label: 'Ethereum',
							usd: [5, 10, 15],
							amount: [0.5, 1, 1.5],
							totalUsd: 30
						}
					]
				}
			}
		}
	]
}

describe('LiquidationsDistributionChart helpers', () => {
	test('keeps the population note left of the snapshot below the chart', () => {
		const html = renderToStaticMarkup(React.createElement(LiquidationsDistributionChartFooter, { timestamp: 1 }))

		expect(html).toContain('justify-between')
		expect(html).toContain('class="ml-auto"')
		expect(html.indexOf('Positions with at least $100k collateral.')).toBeLessThan(html.indexOf('Snapshot Thu'))
	})

	test('defaults to the top collateral token when no query param is present', () => {
		expect(resolveLiquidationsChartTokenKey(chart, undefined)).toBe('WBTC')
	})

	test('supports exact and slugged token query params', () => {
		expect(resolveLiquidationsChartTokenKey(chart, 'ethereum:eth')).toBe('ethereum:eth')
		expect(resolveLiquidationsChartTokenKey(chart, 'ethereum-eth')).toBe('ethereum:eth')
	})

	test('falls back to the top collateral token when the query param is invalid', () => {
		expect(resolveLiquidationsChartTokenKey(chart, 'not-a-token')).toBe('WBTC')
	})

	test('filters the chart down to the selected token', () => {
		expect(getLiquidationsChartView(chart, 'ethereum:eth', 'total')).toEqual({
			bins: [0, 10, 20],
			series: [chart.tokens[1]!.breakdowns.total.series[0]]
		})
	})

	test('trims empty price bins around the selected token', () => {
		expect(
			getLiquidationsChartView(
				{
					tokens: [
						{
							key: 'WETH',
							label: 'WETH',
							totalUsd: 15,
							breakdowns: {
								total: {
									bins: [0, 10, 20, 30, 40],
									series: [
										{
											key: 'WETH',
											label: 'WETH',
											usd: [0, 5, 10, 0, 0],
											amount: [0, 1, 2, 0, 0],
											totalUsd: 15
										}
									]
								},
								protocol: { bins: [0, 10, 20, 30, 40], series: [] },
								chain: { bins: [0, 10, 20, 30, 40], series: [] }
							}
						}
					]
				},
				'WETH',
				'total'
			)
		).toEqual({
			bins: [10, 20],
			series: [
				{
					key: 'WETH',
					label: 'WETH',
					usd: [5, 10],
					amount: [1, 2],
					totalUsd: 15
				}
			]
		})
	})

	test('returns the selected breakdown for a token', () => {
		expect(getLiquidationsChartView(chart, 'WBTC', 'protocol')).toEqual(chart.tokens[0]!.breakdowns.protocol)
	})

	test('builds cumulative liquidation totals from right to left across price buckets', () => {
		expect(
			buildCumulativeLiquidationsChartView({
				bins: [0, 10, 20],
				series: [
					{
						key: 'Aave',
						label: 'Aave',
						usd: [10, 20, 30],
						amount: [1, 2, 3],
						totalUsd: 60
					},
					{
						key: 'Compound',
						label: 'Compound',
						usd: [5, 0, 15],
						amount: [0.5, 0, 1.5],
						totalUsd: 20
					}
				]
			})
		).toEqual({
			bins: [0, 10, 20],
			series: [
				{
					key: 'Aave',
					label: 'Aave',
					usd: [60, 50, 30],
					amount: [6, 5, 3],
					totalUsd: 60
				},
				{
					key: 'Compound',
					label: 'Compound',
					usd: [20, 15, 15],
					amount: [2, 1.5, 1.5],
					totalUsd: 20
				}
			]
		})
	})

	test('exports only visible series with the selected metric', () => {
		const view = chart.tokens[0]!.breakdowns.protocol
		expect(buildLiquidationsChartExportDataset(view, 'amount', new Set(['Aave']))).toEqual({
			dimensions: ['liqPrice', 'Aave'],
			source: [
				[0, 1],
				[10, 2],
				[20, 3]
			]
		})
		expect(buildLiquidationsChartExportDataset(view, 'usd', new Set())).toEqual({
			dimensions: ['liqPrice'],
			source: [[0], [10], [20]]
		})
	})

	test('normalizes metric and breakdown query state', () => {
		expect(getLiquidationsChartMetric(undefined)).toBe('usd')
		expect(getLiquidationsChartMetric('amount')).toBe('amount')
		expect(getLiquidationsChartMode(undefined)).toBe('cumulative')
		expect(getLiquidationsChartMode('distribution')).toBe('distribution')
		expect(getLiquidationsChartMode('invalid')).toBe('cumulative')
		expect(getLiquidationsChartMode(undefined, 'distribution')).toBe('distribution')
		expect(getLiquidationsChartBreakdownMode(undefined)).toBe('total')
		expect(getLiquidationsChartBreakdownMode('protocol')).toBe('protocol')
		expect(getLiquidationsChartBreakdownMode('protocol', ['total', 'chain'])).toBe('total')
		expect(getLiquidationsChartBreakdownMode(undefined, ['chain'])).toBe('chain')
		expect(getLiquidationsChartBreakdownMode(undefined, ['total', 'chain'], 'chain')).toBe('chain')
		expect(getLiquidationsChartBreakdownMode(undefined, ['total', 'chain'], 'protocol')).toBe('total')
	})

	test('drops default chart state from query patches', () => {
		expect(getLiquidationsChartMetricQueryPatch('usd')).toEqual({ metric: undefined })
		expect(getLiquidationsChartMetricQueryPatch('amount')).toEqual({ metric: 'amount' })
		expect(getLiquidationsChartModeQueryPatch('cumulative')).toEqual({ view: undefined })
		expect(getLiquidationsChartModeQueryPatch('distribution')).toEqual({ view: 'distribution' })
		expect(getLiquidationsChartModeQueryPatch('distribution', 'distribution')).toEqual({ view: undefined })
		expect(getLiquidationsChartModeQueryPatch('cumulative', 'distribution')).toEqual({ view: 'cumulative' })
		expect(getLiquidationsChartBreakdownQueryPatch('total')).toEqual({ breakdown: undefined })
		expect(getLiquidationsChartBreakdownQueryPatch('chain')).toEqual({ breakdown: 'chain' })
		expect(getLiquidationsChartBreakdownQueryPatch('total', 'chain')).toEqual({ breakdown: 'total' })
		expect(getLiquidationsChartBreakdownQueryPatch('chain', 'chain')).toEqual({ breakdown: undefined })
		expect(getLiquidationsChartTokenQueryPatch('WBTC', 'WBTC')).toEqual({ token: undefined })
		expect(getLiquidationsChartTokenQueryPatch('ethereum:eth', 'WBTC')).toEqual({ token: 'ethereum:eth' })
	})
})
