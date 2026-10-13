import { describe, expect, test } from 'vitest'
import {
	buildProtocolFeeChartPresentation,
	getProtocolFeeBreakdownPanels,
	rankBreakdownNames
} from '../protocolFeeCharts'

describe('buildProtocolFeeChartPresentation', () => {
	test('builds only the selected base fee series', () => {
		const result = buildProtocolFeeChartPresentation({
			fees: [[1, 100]],
			revenue: [[1, 20]],
			holdersRevenue: [[1, 5]],
			selectedCharts: ['Fees', 'Holders Revenue'],
			groupBy: 'daily'
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Fees', 'Holders Revenue'],
			source: [[0, 100, 5]]
		})
		expect(result.charts).toMatchObject([
			{ type: 'bar', name: 'Fees', stack: 'Fees' },
			{ type: 'bar', name: 'Holders Revenue', stack: 'Holders Revenue' }
		])
	})

	test('preserves sparse starts between cumulative fee-family lines', () => {
		const result = buildProtocolFeeChartPresentation({
			fees: [
				[1, 10],
				[2, 5]
			],
			revenue: [[2, 3]],
			holdersRevenue: [],
			selectedCharts: ['Fees', 'Revenue'],
			groupBy: 'cumulative'
		})

		expect(result.dataset.source).toEqual([
			[1000, 10, null],
			[2000, 15, 3]
		])
		expect(result.charts.map((chart) => chart.type)).toEqual(['line', 'line'])
	})
})

test('ranks breakdown names by their total over the whole history', () => {
	expect(
		rankBreakdownNames([
			[1, { 'Spot Fees': 5, 'Perp Fees': 3 }],
			[2, { 'Perp Fees': 4, 'Builder Code Fees': 1 }]
		])
	).toEqual(['Perp Fees', 'Spot Fees', 'Builder Code Fees'])
})

test('shows each fee and revenue breakdown once it has more than one chain, version or label, independently', () => {
	const panels = getProtocolFeeBreakdownPanels({
		protocolChains: ['Ethereum'],
		protocolFeesVersions: ['V1', 'V2'],
		protocolFeesLabels: ['Perp Fees', 'Spot Fees'],
		protocolRevenueChains: ['Arbitrum', 'Base'],
		protocolRevenueVersions: ['Standalone'],
		protocolRevenueLabels: ['Perp Fees']
	})
	expect(panels.map((panel) => [panel.title, panel.dataType ?? null, panel.breakdownNames])).toEqual([
		['Fees by protocol version', null, ['V1', 'V2']],
		['Fees by financial label', null, ['Perp Fees', 'Spot Fees']],
		['Revenue by chain', 'dailyRevenue', ['Arbitrum', 'Base']]
	])

	const swapped = getProtocolFeeBreakdownPanels({
		protocolChains: ['Ethereum', 'Base'],
		protocolFeesVersions: ['V1'],
		protocolFeesLabels: ['Perp Fees'],
		protocolRevenueChains: ['Arbitrum'],
		protocolRevenueVersions: ['V1', 'V2'],
		protocolRevenueLabels: ['Perp Fees', 'Spot Fees']
	})
	expect(swapped.map((panel) => [panel.title, panel.chartType, panel.dataType ?? null])).toEqual([
		['Fees by chain', 'chain', null],
		['Revenue by protocol version', 'version', 'dailyRevenue'],
		['Revenue by financial label', 'label', 'dailyRevenue']
	])
})
