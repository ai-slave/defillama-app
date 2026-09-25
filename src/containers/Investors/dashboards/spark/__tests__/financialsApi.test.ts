import { describe, expect, test } from 'vitest'
import { buildFinancialsViewModel, type FinancialsAPIResponse, type TimeSeriesData } from '../financialsApi'

function chart(title: string, name: string, data: Array<number> = [1, 2]): TimeSeriesData {
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

describe('buildFinancialsViewModel', () => {
	test('preserves missing-as-zero datasets and chart presentation configs', () => {
		const result = buildFinancialsViewModel(buildResponse())

		expect(result.monthlyGross.dataset.source).toEqual([
			[Date.UTC(2026, 0, 1), 4, 2],
			[Date.UTC(2026, 0, 2), 5, 0]
		])
		expect(result.monthlyGross.charts).toMatchObject([
			{ name: 'Gross A', type: 'bar', stack: 'a', encode: { x: 0, y: 1 } },
			{ name: 'Gross B', type: 'bar', stack: 'a', encode: { x: 0, y: 2 } }
		])
		expect(result.borrows.charts).toEqual([{ name: 'Borrows', type: 'line', color: '#f85149', encode: { x: 0, y: 1 } }])
		expect(result.aaHistorical.byProtocol.charts[0]).toMatchObject({
			name: 'Protocol',
			type: 'line',
			stack: 'a'
		})
	})

	test('draws the buyback threshold on every treasury row and plots price on a second axis', () => {
		const result = buildFinancialsViewModel(buildResponse())

		expect(result.treasuryModel.dataset.source).toEqual([
			[Date.UTC(2030, 0, 1), 100, 20, 80],
			[Date.UTC(2030, 1, 1), 110, 30, 80]
		])
		expect(result.buybacksModel.dataset.source).toEqual([
			[Date.UTC(2031, 0, 1), 2, 1],
			[Date.UTC(2031, 0, 2), 3, 1.5]
		])
		expect(result.buybacksModel.charts.map((series) => [series.name, series.yAxisIndex])).toEqual([
			['SPK Bought', 0],
			['Average Price', 1]
		])
	})
})
