import { describe, expect, it } from 'vitest'
import type { DimensionDatasetProtocol } from '~/containers/AdapterMetrics/server/datasets'
import {
	buildDimensionDatasetCSV,
	filterDimensionDatasetRows,
	getDimensionDatasetCategories,
	sanitizeDimensionDatasetCategories
} from './dimensionDatasetUtils'

const rows: DimensionDatasetProtocol[] = [
	{
		name: 'Alpha',
		category: 'Lending',
		total24h: 10,
		total7d: 70,
		total30d: 300,
		change_1d: 1,
		change_7d: 2,
		chains: ['Ethereum', 'Base']
	},
	{
		name: 'Beta',
		category: 'Dexes',
		total24h: 20,
		total7d: null,
		total30d: 400,
		change_1d: 0,
		change_7d: null,
		chains: []
	},
	{
		name: 'Gamma',
		category: 'Lending',
		total24h: 5,
		total7d: 35,
		total30d: 150,
		change_1d: -1,
		change_7d: -2,
		chains: ['Arbitrum']
	},
	{ name: 'Unknown', category: '', chains: ['Optimism'] }
]

describe('dimension dataset construction', () => {
	it('derives sorted non-empty categories and sanitizes persisted selections', () => {
		expect(getDimensionDatasetCategories(rows)).toEqual(['Dexes', 'Lending'])
		const available = new Set(['Dexes', 'Lending'])
		expect(sanitizeDimensionDatasetCategories(['Stale', 'Lending'], available)).toEqual(['Lending'])
		expect(sanitizeDimensionDatasetCategories([], new Set())).toEqual([])
	})

	it('preserves input identity without filters and applies include then exclude semantics', () => {
		const snapshot = structuredClone(rows)
		expect(filterDimensionDatasetRows(rows, [], [])).toBe(rows)
		expect(filterDimensionDatasetRows(rows, ['Lending'], [])).toEqual([rows[0], rows[2]])
		expect(filterDimensionDatasetRows(rows, [], ['Dexes'])).toEqual([rows[0], rows[2], rows[3]])
		expect(filterDimensionDatasetRows(rows, ['Lending', 'Dexes'], ['Lending'])).toEqual([rows[1]])
		expect(rows).toEqual(snapshot)
	})

	it.each(['Revenue', 'Fees', 'Holders Revenue', 'Earnings'])(
		'preserves exact %s CSV bytes with and without chain-selected columns',
		(metricLabel) => {
			const withChanges = buildDimensionDatasetCSV(rows.slice(0, 2), metricLabel, true)
			const withoutChanges = buildDimensionDatasetCSV(rows.slice(0, 2), metricLabel, false)

			expect(withChanges).toBe(
				`Protocol,Category,24h ${metricLabel},7d ${metricLabel},30d ${metricLabel},24h Change,7d Change,Chains\n` +
					'Alpha,Lending,10,70,300,1,2,Ethereum;Base\n' +
					'Beta,Dexes,20,,400,0,,'
			)
			expect(withoutChanges).toBe(
				`Protocol,Category,24h ${metricLabel},7d ${metricLabel},30d ${metricLabel},Chains\n` +
					'Alpha,Lending,10,70,300,Ethereum;Base\n' +
					'Beta,Dexes,20,,400,'
			)
		}
	)
})
