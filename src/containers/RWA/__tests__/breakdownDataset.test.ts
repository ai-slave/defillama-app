import { describe, expect, it } from 'vitest'
import { toOverviewBreakdownChartDataset, toRwaPositionalChartDataset } from '../breakdownDataset'

describe('rwa breakdownDataset', () => {
	for (const rows of [null, []] as Array<Parameters<typeof toRwaPositionalChartDataset>[0]>) {
		it(`returns an empty positional dataset when receiving ${JSON.stringify(rows)}`, () => {
			expect(toRwaPositionalChartDataset(rows)).toEqual({
				source: [],
				dimensions: ['timestamp']
			})
		})
	}

	it('keeps server row order while building the dataset', () => {
		expect(
			toRwaPositionalChartDataset([
				{ timestamp: 1774569600000, Ethereum: 130 },
				{ timestamp: 1774483200000, Solana: 120 }
			])
		).toEqual({
			source: [
				[1774569600000, 130, null],
				[1774483200000, null, 120]
			],
			dimensions: ['timestamp', 'Ethereum', 'Solana']
		})
	})

	it('uses JSON-safe nulls for sparse server-prop cells', () => {
		const dataset = toRwaPositionalChartDataset([
			{ timestamp: 1, Ethereum: 10 },
			{ timestamp: 2, Solana: 20 }
		])

		expect(JSON.parse(JSON.stringify(dataset))).toEqual(dataset)
	})

	it('keeps single-row input unchanged and builds the expected dataset', () => {
		const singleRow = [{ timestamp: 1_774_489_600_000, Ethereum: 120 }]

		expect(toRwaPositionalChartDataset(singleRow)).toEqual({
			source: [[1_774_489_600_000, 120]],
			dimensions: ['timestamp', 'Ethereum']
		})
	})

	it('preserves zero values returned by the backend', () => {
		expect(
			toRwaPositionalChartDataset([
				{ timestamp: 1_000, PreStocks: 0, Securitize: 10 },
				{ timestamp: 2_000, PreStocks: 0, Securitize: 11 },
				{ timestamp: 3_000, PreStocks: 12, Securitize: 12 },
				{ timestamp: 4_000, PreStocks: 0, Securitize: 13 }
			])
		).toEqual({
			source: [
				[1_000, 0, 10],
				[2_000, 0, 11],
				[3_000, 12, 12],
				[4_000, 0, 13]
			],
			dimensions: ['timestamp', 'PreStocks', 'Securitize']
		})
	})

	it('adds overview totals only for the requested aggregate pages', () => {
		const rows = [{ timestamp: 1, Ethereum: 10, Solana: 5 }]

		const aggregate = toOverviewBreakdownChartDataset(rows, {
			breakdown: 'chain',
			key: 'activeMcap',
			includeStablecoin: false,
			includeGovernance: false
		})
		expect(aggregate).toEqual({
			dimensions: ['timestamp', 'Total Active Mcap', 'Ethereum', 'Solana'],
			source: [[1, 15, 10, 5]]
		})

		expect(
			toOverviewBreakdownChartDataset(rows, {
				breakdown: 'category',
				key: 'activeMcap',
				includeStablecoin: false,
				includeGovernance: false
			}).dimensions
		).toEqual(['timestamp', 'Ethereum', 'Solana'])
	})
})
