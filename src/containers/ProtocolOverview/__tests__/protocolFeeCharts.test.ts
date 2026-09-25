import { describe, expect, test } from 'vitest'
import { buildProtocolFeeChartPresentation, getProtocolFeeBreakdownPanels } from '../protocolFeeCharts'

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

test('shows each fee and revenue breakdown once it has more than one chain or version, independently', () => {
	const panels = getProtocolFeeBreakdownPanels({
		protocolChains: ['Ethereum'],
		protocolFeesVersions: ['V1', 'V2'],
		protocolRevenueChains: ['Arbitrum', 'Base'],
		protocolRevenueVersions: ['Standalone']
	})
	expect(panels.map((panel) => [panel.title, panel.dataType ?? null, panel.breakdownNames])).toEqual([
		['Fees by protocol version', null, ['V1', 'V2']],
		['Revenue by chain', 'dailyRevenue', ['Arbitrum', 'Base']]
	])

	const swapped = getProtocolFeeBreakdownPanels({
		protocolChains: ['Ethereum', 'Base'],
		protocolFeesVersions: ['V1'],
		protocolRevenueChains: ['Arbitrum'],
		protocolRevenueVersions: ['V1', 'V2']
	})
	expect(swapped.map((panel) => [panel.title, panel.chartType, panel.dataType ?? null])).toEqual([
		['Fees by chain', 'chain', null],
		['Revenue by protocol version', 'version', 'dailyRevenue']
	])
})
