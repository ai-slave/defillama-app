import { describe, expect, test } from 'vitest'
import { toOverviewBreakdownChartDataset, toRwaPositionalChartDataset } from '../breakdownDataset'

describe('rwa breakdownDataset', () => {
	for (const rows of [null, []] as Array<Parameters<typeof toRwaPositionalChartDataset>[0]>) {
		test(`returns an empty positional dataset when receiving ${JSON.stringify(rows)}`, () => {
			expect(toRwaPositionalChartDataset(rows)).toEqual({
				source: [],
				dimensions: ['timestamp']
			})
		})
	}

	test('keeps server row order while building the dataset', () => {
		expect(
			toRwaPositionalChartDataset([
				{ timestamp: 1_774_569_600_000, Ethereum: 130 },
				{ timestamp: 1_774_483_200_000, Solana: 120 }
			])
		).toEqual({
			source: [
				[1_774_569_600_000, 130, null],
				[1_774_483_200_000, null, 120]
			],
			dimensions: ['timestamp', 'Ethereum', 'Solana']
		})
	})

	test('uses JSON-safe nulls for sparse server-prop cells', () => {
		const dataset = toRwaPositionalChartDataset([
			{ timestamp: 1, Ethereum: 10 },
			{ timestamp: 2, Solana: 20 }
		])

		expect(JSON.parse(JSON.stringify(dataset))).toEqual(dataset)
	})

	test('keeps single-row input unchanged and builds the expected dataset', () => {
		const singleRow = [{ timestamp: 1_774_489_600_000, Ethereum: 120 }]

		expect(toRwaPositionalChartDataset(singleRow)).toEqual({
			source: [[1_774_489_600_000, 120]],
			dimensions: ['timestamp', 'Ethereum']
		})
	})

	test('preserves zero values returned by the backend', () => {
		expect(
			toRwaPositionalChartDataset([
				{ timestamp: 1000, PreStocks: 0, Securitize: 10 },
				{ timestamp: 2000, PreStocks: 0, Securitize: 11 },
				{ timestamp: 3000, PreStocks: 12, Securitize: 12 },
				{ timestamp: 4000, PreStocks: 0, Securitize: 13 }
			])
		).toEqual({
			source: [
				[1000, 0, 10],
				[2000, 0, 11],
				[3000, 12, 12],
				[4000, 0, 13]
			],
			dimensions: ['timestamp', 'PreStocks', 'Securitize']
		})
	})

	test('adds overview totals only for the requested aggregate pages', () => {
		const rows = [{ timestamp: 1, Ethereum: 10, Solana: 5 }]

		const aggregate = toOverviewBreakdownChartDataset(rows, {
			breakdown: 'chain',
			key: 'activeMcap',
			includeStablecoin: false,
			includeGovernance: false
		})
		expect(aggregate).toEqual({
			dimensions: ['timestamp', 'Total Active AUM', 'Ethereum', 'Solana'],
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
