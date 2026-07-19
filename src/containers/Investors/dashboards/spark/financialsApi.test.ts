import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildFinancialsViewModel, type FinancialsAPIResponse, type TimeSeriesData } from './financialsApi'

function chart(title: string, name: string, data: number[] = [1, 2]): TimeSeriesData {
	return { title, dates: ['2026-01-01', '2026-01-02'], series: [{ name, data }] }
}

function buildResponse(): FinancialsAPIResponse {
	return {
		meta: {
			projectId: 1,
			projectName: 'Spark',
			updatedAt: '2026-01-03',
			links: { website: 'https://spark.fi' },
			quarterlyReports: [{ label: 'Q1', url: 'https://spark.fi/q1' }]
		},
		kpis: [{ label: 'Revenue', value: 12, formatted: '$12' }],
		treasuryKpis: {
			totalAssets: { value: 100, formatted: '$100' },
			buybackThreshold: { value: 80, formatted: '$80' },
			vsThreshold: { value: 20, formatted: '$20' }
		},
		buybackKpis: {
			usdsSpent: { value: 10, formatted: '$10' },
			spkBought: { value: 5, formatted: '5 SPK' },
			avgPrice: { value: 2, formatted: '$2' }
		},
		charts: {
			projectedBreakdown: {
				title: 'Projected',
				total: 10,
				totalFormatted: '$10',
				series: [{ name: 'Lending', value: 10, formatted: '$10', pct: 100 }]
			},
			monthlyGross: {
				title: 'Gross',
				dates: ['2026-01-01', '2026-01-02'],
				series: [
					{ name: 'Gross A', data: [4, 5] },
					{ name: 'Gross B', data: [2] }
				]
			},
			monthlyNet: chart('Net', 'Net'),
			allocatedAssets: {
				title: 'Allocated Assets',
				total: 100,
				totalFormatted: '$100',
				date: '2026-01-02',
				byProtocol: [{ name: 'Protocol', value: 100, formatted: '$100', pct: 100 }],
				byNetwork: [{ name: 'Network', value: 100, formatted: '$100', pct: 100 }],
				byAsset: [{ name: 'USDS', value: 100, formatted: '$100', pct: 100 }],
				historical: {
					dates: ['2026-01-01', '2026-01-02'],
					byProtocol: [{ name: 'Protocol', data: [90, 100] }],
					byNetwork: [{ name: 'Network', data: [90, 100] }],
					byAsset: [{ name: 'USDS', data: [90, 100] }]
				}
			},
			tvl: { ...chart('TVL', 'Ethereum'), current: 100, currentFormatted: '$100' },
			sparklendDeposits: chart('Deposits', 'Deposits'),
			sparklendBorrows: chart('Borrows', 'Borrows'),
			sllTvl: chart('SLL TVL', 'Ethereum'),
			savingsTvl: chart('Savings TVL', 'Ethereum'),
			supplyTotal: chart('Supply', 'Supply'),
			supplyByChain: chart('Supply by chain', 'Ethereum'),
			treasury: {
				title: 'Treasury',
				dates: ['2030-01', '2030-02'],
				series: [
					{ name: 'Assets A', data: [100, 110] },
					{ name: 'Assets B', data: [20, 30] }
				],
				threshold: 80,
				thresholdFormatted: '$80'
			},
			buybacks: {
				title: 'Buybacks',
				dates: ['2031-01-01', '2031-01-02'],
				series: [
					{ name: 'SPK Bought', type: 'bar', data: [2, 3] },
					{ name: 'Average Price', type: 'line', data: [1, 1.5] }
				]
			}
		}
	}
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe('buildFinancialsViewModel', () => {
	it('caches only rendered values and canonical chart models', () => {
		const response = buildResponse()
		const result = buildFinancialsViewModel(response)

		expect(result.kpis).toBe(response.kpis)
		expect(result.projectedBreakdown).toBe(response.charts.projectedBreakdown)
		expect(result.projectedBreakdown.series).toBe(response.charts.projectedBreakdown.series)
		expect(result).not.toHaveProperty('meta')
		expect(result).not.toHaveProperty('charts')
		expect(result).not.toHaveProperty('breakdownPieData')
		expect(result).not.toHaveProperty('treasuryThreshold')
		expect(result).not.toHaveProperty('treasuryThresholdFormatted')
		expect(result.allocatedAssets).toEqual({
			title: 'Allocated Assets',
			totalFormatted: '$100',
			byProtocol: response.charts.allocatedAssets.byProtocol,
			byNetwork: response.charts.allocatedAssets.byNetwork,
			byAsset: response.charts.allocatedAssets.byAsset
		})
		expect(result.allocatedAssets).not.toHaveProperty('historical')
		expect(result.allocatedAssets).not.toHaveProperty('total')
		expect(result.allocatedAssets).not.toHaveProperty('date')
	})

	it('preserves missing-as-zero datasets and chart presentation configs', () => {
		const result = buildFinancialsViewModel(buildResponse())

		expect(result.monthlyGross.dataset.source).toEqual([
			{ timestamp: Date.UTC(2026, 0, 1), 'Gross A': 4, 'Gross B': 2 },
			{ timestamp: Date.UTC(2026, 0, 2), 'Gross A': 5, 'Gross B': 0 }
		])
		expect(result.monthlyGross.charts).toMatchObject([
			{ name: 'Gross A', type: 'bar', stack: 'a', encode: { x: 'timestamp', y: 'Gross A' } },
			{ name: 'Gross B', type: 'bar', stack: 'a', encode: { x: 'timestamp', y: 'Gross B' } }
		])
		expect(result.borrows.charts).toEqual([
			{ name: 'Borrows', type: 'line', color: '#f85149', encode: { x: 'timestamp', y: 'Borrows' } }
		])
		expect(result.aaHistorical.byProtocol.charts[0]).toMatchObject({
			name: 'Protocol',
			type: 'line',
			stack: 'a'
		})
	})

	it('parses each legacy date array once and preserves axes, colors, order, and threshold opacity', () => {
		const parse = vi.spyOn(Date, 'parse')
		const result = buildFinancialsViewModel(buildResponse())
		const treasuryCalls = parse.mock.calls.filter(([value]) => String(value).startsWith('2030-'))
		const buybackCalls = parse.mock.calls.filter(([value]) => String(value).startsWith('2031-'))

		expect(treasuryCalls).toHaveLength(2)
		expect(buybackCalls).toHaveLength(2)
		expect(result.treasurySeries).toEqual([
			{
				name: 'Assets A',
				type: 'line',
				color: '#4FC3F7',
				data: [
					[Date.UTC(2030, 0, 1) / 1000, 100],
					[Date.UTC(2030, 1, 1) / 1000, 110]
				]
			},
			{
				name: 'Assets B',
				type: 'line',
				color: '#4FC3F7',
				data: [
					[Date.UTC(2030, 0, 1) / 1000, 20],
					[Date.UTC(2030, 1, 1) / 1000, 30]
				]
			},
			{
				name: 'Buyback Threshold',
				type: 'line',
				color: '#EF5350',
				areaStyle: { opacity: 0 },
				data: [
					[Date.UTC(2030, 0, 1) / 1000, 80],
					[Date.UTC(2030, 1, 1) / 1000, 80]
				]
			}
		])
		expect(result.buybacksSeries).toEqual([
			{
				name: 'SPK Bought',
				type: 'bar',
				color: '#1f6feb',
				data: [
					[Date.UTC(2031, 0, 1) / 1000, 2],
					[Date.UTC(2031, 0, 2) / 1000, 3]
				],
				yAxisIndex: 0,
				areaStyle: undefined
			},
			{
				name: 'Average Price',
				type: 'line',
				color: '#3fb950',
				data: [
					[Date.UTC(2031, 0, 1) / 1000, 1],
					[Date.UTC(2031, 0, 2) / 1000, 1.5]
				],
				yAxisIndex: 1,
				areaStyle: { opacity: 0 }
			}
		])
	})
})
