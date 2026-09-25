import { describe, expect, test } from 'vitest'
import { constructTestTable } from '~/components/Table/__tests__/helpers/constructTestTable'
import { serializeCsv } from '~/utils/csv'
import { buildRaisesData } from './hooks'
import type { Raise } from './model'
import { prepareRaisesCsv, raisesColumns, tableFeaturesConfig } from './Table'
import { getRaisesFiltersList } from './utils'

function raise(name: string, amountUsd: number | null, overrides: Partial<Raise> = {}): Raise {
	return {
		name,
		amountUsd,
		date: 1_737_331_200,
		round: 'Seed',
		chains: ['Ethereum'],
		sector: null,
		category: 'DeFi',
		categoryGroup: 'DeFi',
		leadInvestors: ['Fund'],
		otherInvestors: [],
		valuationUsd: null,
		source: '',
		...overrides
	}
}

function transform(raises: Array<Raise>, query: Record<string, string | Array<string>> = {}) {
	return buildRaisesData({ raises, ...getRaisesFiltersList({ raises }) }, query)
}

describe('Raises filters and chart population', () => {
	const rows = [raise('Unknown', null), raise('Zero', 0), raise('Small', 500_000), raise('Large', 2_000_000)]

	test.each([
		{ query: {}, names: ['Unknown', 'Zero', 'Small', 'Large'], total: 2_500_000, undisclosed: 1 },
		{ query: { maxRaised: '1000000' }, names: ['Zero', 'Small'], total: 500_000, undisclosed: 0 },
		{ query: { minRaised: '500000' }, names: ['Small', 'Large'], total: 2_500_000, undisclosed: 0 },
		{ query: { minRaised: '500000', maxRaised: '1000000' }, names: ['Small'], total: 500_000, undisclosed: 0 },
		{ query: { maxRaised: '0' }, names: ['Zero'], total: 0, undisclosed: 0 },
		{ query: { minRaised: '0' }, names: ['Zero', 'Small', 'Large'], total: 2_500_000, undisclosed: 0 },
		{
			query: { minRaised: 'invalid', maxRaised: '' },
			names: ['Unknown', 'Zero', 'Small', 'Large'],
			total: 2_500_000,
			undisclosed: 1
		}
	])('keeps row, chart and CSV populations consistent for $query', ({ query, names, total, undisclosed }) => {
		const data = transform(rows, query)
		expect(data.filteredRaisesList.map((row) => row.name)).toEqual(names)
		expect(data.totalAmountRaised).toBe(total)
		expect(data.fundingSummary).toEqual({ totalUsd: total, undisclosedCount: undisclosed })
		expect(data.monthlyInvestmentChart.dataset.source).toEqual([[Date.UTC(2025, 0, 1), total]])
		expect(data.fundingRoundsByMonthChart.dataset.source).toEqual([[Date.UTC(2025, 0, 1), names.length]])
		const table = constructTestTable({
			features: tableFeaturesConfig,
			data: data.filteredRaisesList,
			columns: raisesColumns,
			state: {},
			renderFallbackValue: null
		})
		expect(
			prepareRaisesCsv(table)
				.rows.slice(1)
				.map((row) => row[0])
		).toEqual(names)
	})

	test('preserves All and None, exact producer labels and exclusions', () => {
		const data = [
			raise('A', 1, { leadInvestors: ['Fund', 'Other'], chains: ['Blast'], round: 'Strategic' }),
			raise('B', 2, { leadInvestors: ['fund'], chains: ['Ethereum'], round: 'Seed' })
		]
		expect(transform(data, { investor: 'All', chain: 'All', round: 'All', sector: 'All' }).filteredRaisesList).toEqual(
			data
		)
		for (const key of ['investor', 'chain', 'round', 'sector']) {
			const empty = transform(data, { [key]: 'None' })
			expect(empty.filteredRaisesList).toEqual([])
			expect(empty.totalAmountRaised).toBe(0)
			expect(empty.monthlyInvestmentChart.dataset.source).toEqual([])
		}
		expect(transform(data, { investor: 'Fund', chain: 'Blast', round: 'Strategic' }).filteredRaisesList).toEqual([
			data[0]
		])
		expect(transform(data, { excludeInvestor: 'Other', excludeChain: 'Blast' }).filteredRaisesList).toEqual([data[1]])
	})

	test('keeps EOS spread over 13 months and series chronologically ordered', () => {
		const data = transform([raise('EOS', 4_200_000_000, { date: 1_527_811_200 })])
		const amounts = data.monthlyInvestmentChart.dataset.source
		const counts = data.fundingRoundsByMonthChart.dataset.source
		expect(amounts).toHaveLength(13)
		expect(counts).toHaveLength(13)
		expect(data.totalAmountRaised).toBeCloseTo(4_200_000_000)
		expect(amounts.map((row) => row[0])).toEqual(amounts.map((row) => row[0]).toSorted())
		for (const row of amounts) expect(row[1]).toBe(4_200_000_000 / 13)
		for (const row of counts) expect(row[1]).toBe(1)
	})
})

describe('Shared Raises CSV contract', () => {
	test('exports raw whole USD and both dates in table sort order, with unknowns last and zero intact', () => {
		const table = constructTestTable({
			features: tableFeaturesConfig,
			data: [raise('Unknown', null), raise('Zero', 0), raise('Measured', 3_100_000, { valuationUsd: 300_000_000 })],
			columns: raisesColumns,
			state: { sorting: [{ id: 'amount', desc: false }] },
			defaultColumn: { sortUndefined: 'last' },
			renderFallbackValue: null
		})
		const csv = prepareRaisesCsv(table)
		const header = csv.rows[0]!
		const cells = (name: string) => csv.rows.slice(1).map((row) => row[header.indexOf(name)])
		expect(cells('Name')).toEqual(['Zero', 'Measured', 'Unknown'])
		expect(cells('Amount Raised')).toEqual([0, 3_100_000, ''])
		expect(cells('Valuation')).toEqual(['', 300_000_000, ''])
		expect(cells('Timestamp')).toEqual([1_737_331_200, 1_737_331_200, 1_737_331_200])
		expect(cells('Date')).toEqual(['2025-01-20', '2025-01-20', '2025-01-20'])
		expect(serializeCsv(csv.rows)).toContain('Measured,1737331200,2025-01-20,3100000,')
		expect(serializeCsv(csv.rows)).not.toContain('$3.1m')
	})
})
