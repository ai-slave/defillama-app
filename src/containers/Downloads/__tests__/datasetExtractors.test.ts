import { describe, expect, test } from 'vitest'
import { chartDatasetsBySlug } from '../chart-datasets'
import { datasetsBySlug } from '../datasets'

function dataset(slug: string) {
	const definition = datasetsBySlug.get(slug)
	if (!definition) throw new Error(`Missing dataset: ${slug}`)
	return definition
}

function chartDataset(slug: string) {
	const definition = chartDatasetsBySlug.get(slug)
	if (!definition) throw new Error(`Missing chart dataset: ${slug}`)
	return definition
}

describe('strict download dataset extractors', () => {
	test('exposes legacy funding and LSD rate datasets with their original contracts', () => {
		const perpFunding = dataset('perp-funding')
		const lsdRates = dataset('lsd-rates')

		expect(perpFunding.url).toBe('')
		expect(perpFunding.defaultSortField).toBe('openInterest')
		expect(perpFunding.fields).toContain('fundingRate30dSum')
		expect(perpFunding.extractItems({ data: [{ marketplace: 'Binance' }] })).toEqual([{ marketplace: 'Binance' }])
		expect(lsdRates.url).toBe('')
		expect(lsdRates.extractItems([{ name: 'Lido', symbol: 'stETH' }])).toEqual([{ name: 'Lido', symbol: 'stETH' }])
	})

	test('preserves protocol percentage calculations and chain data', () => {
		const rows = dataset('protocols').extractItems({
			protocols: [
				{
					name: 'Aave',
					symbol: 'AAVE',
					category: 'Lending',
					chains: ['Ethereum'],
					tvl: 120,
					tvlPrevDay: 100,
					tvlPrevWeek: 80,
					tvlPrevMonth: 60,
					mcap: 500,
					url: 'https://aave.com',
					chainTvls: { Ethereum: { tvl: 120 } }
				}
			]
		})

		expect(rows).toEqual([
			expect.objectContaining({
				name: 'Aave',
				chain: 'Ethereum',
				change_1d: 20,
				change_7d: 50,
				change_1m: 100,
				chainTvls: { Ethereum: { tvl: 120 } }
			})
		])
	})

	test('preserves grouped protocol ordering and child labels', () => {
		const options = chartDataset('protocol-fees-chart').extractOptions({
			protocols: [
				{ name: 'Solo', displayName: 'Solo', total24h: 30 },
				{ name: 'Child A', displayName: 'Child A', total24h: 20, parentProtocol: 'parent#1' },
				{ name: 'Child B', displayName: 'Child B', total24h: 10, parentProtocol: 'parent#1' }
			],
			parentProtocols: [{ id: 'parent#1', name: 'Parent' }]
		})

		expect(options).toEqual([
			{ label: 'Solo', value: 'solo', category: undefined },
			{ label: 'Parent', value: 'parent', category: undefined },
			{ label: 'Child A', value: 'child-a', category: undefined, isChild: true },
			{ label: 'Child B', value: 'child-b', category: undefined, isChild: true }
		])
	})

	test('keeps timestamp/value pairs unchanged', () => {
		expect(
			chartDataset('protocol-fees-chart').extractRows([
				[1, 12.5],
				[2, 0]
			])
		).toEqual([
			{ date: 1, value: 12.5 },
			{ date: 2, value: 0 }
		])
	})

	test('exports hacks and raises with explicit whole-USD fields', () => {
		const hacks = dataset('hacks').extractItems([
			{
				date: 1,
				name: 'Protocol',
				amount: 8_000_000,
				returnedFunds: 2_000_000
			}
		])
		const raises = dataset('raises').extractItems({
			raises: [
				{
					date: 1,
					name: 'Protocol',
					round: 'Seed',
					amount: 3.1,
					chains: [],
					sector: 'DeFi',
					category: 'DeFi',
					categoryGroup: 'DeFi',
					leadInvestors: [],
					otherInvestors: [],
					valuation: '300'
				}
			]
		})

		expect(hacks[0]).toMatchObject({ amountUsd: 8_000_000, returnedFundsUsd: 2_000_000 })
		expect(hacks[0]).not.toHaveProperty('amount')
		expect(raises[0]).toMatchObject({ amountUsd: 3_100_000, valuationUsd: 300_000_000 })
		expect(raises[0]).not.toHaveProperty('amount')
		expect(raises[0]).not.toHaveProperty('valuation')
	})
})
