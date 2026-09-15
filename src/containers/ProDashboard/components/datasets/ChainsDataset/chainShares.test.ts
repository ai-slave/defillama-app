import type { Table } from '@tanstack/react-table'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type { ChainsDatasetRow } from '~/containers/ChainsByCategory/types'
import { buildChainShareTotals, getChainMetricShare } from './chainShares'
import type { tableFeaturesConfig } from './index'
import { ChainsDataset } from './index'

const mocks = vi.hoisted(() => ({
	data: [] as Array<ChainsDatasetRow>,
	table: null as Table<typeof tableFeaturesConfig, ChainsDatasetRow> | null
}))
vi.mock('./useChainsData', () => ({ useChainsData: () => ({ data: mocks.data, isLoading: false, error: null }) }))
vi.mock('./ChainsTableHeader', () => ({ ChainsTableHeader: () => null }))
vi.mock('./ColumnManagementPanel', () => ({ ColumnManagementPanel: () => null }))
vi.mock('../../Table/TablePagination', () => ({ TablePagination: () => null }))
vi.mock('../../Table/TableBody', () => ({
	TableBody: ({ table }: { table: Table<typeof tableFeaturesConfig, ChainsDatasetRow> }) => {
		mocks.table = table
		return null
	}
}))

function chain(name: string, totalFees24h: number | null): ChainsDatasetRow {
	return {
		name,
		icon: '',
		protocols: 0,
		deprecated: false,
		users: null,
		change_1d: null,
		change_7d: null,
		change_1m: null,
		tvl: 1,
		stablesMcap: null,
		totalVolume24h: null,
		totalVolume7d: null,
		totalVolume30d: null,
		totalFees24h,
		totalFees7d: null,
		totalFees30d: null,
		totalRevenue24h: null,
		totalRevenue7d: null,
		totalRevenue30d: null,
		totalAppRevenue24h: null,
		totalAppRevenue7d: null,
		totalAppRevenue30d: null,
		bridgedTvl: null,
		mcaptvl: null,
		mcap: null,
		symbol: null,
		extraTvl: null
	}
}

describe('chain metric shares', () => {
	test.each([true, false])('sorts signed shares with missing values last when descending=%s', (desc) => {
		mocks.data = [chain('Positive', 100), chain('Unknown', null), chain('Zero', 0), chain('Adjustment', -20)]
		renderToStaticMarkup(createElement(ChainsDataset))
		const table = mocks.table!
		table.setOptions((options) => ({
			...options,
			state: { ...options.state, sorting: [{ id: 'totalFees24h_share', desc }] }
		}))

		expect(
			table.getSortedRowModel().rows.map((row) => [row.original.name, row.getValue('totalFees24h_share')])
		).toEqual(
			desc
				? [
						['Positive', 125],
						['Zero', 0],
						['Adjustment', -25],
						['Unknown', undefined]
					]
				: [
						['Adjustment', -25],
						['Zero', 0],
						['Positive', 125],
						['Unknown', undefined]
					]
		)
	})

	test.each([0, -10])('keeps shares unavailable when the total is %s', (total) => {
		mocks.data = [chain('First', total), chain('Zero', 0), chain('Unknown', null)]
		renderToStaticMarkup(createElement(ChainsDataset))
		const table = mocks.table!
		table.setOptions((options) => ({
			...options,
			state: { ...options.state, sorting: [{ id: 'totalFees24h_share', desc: true }] }
		}))

		expect(table.getSortedRowModel().rows.map((row) => row.getValue('totalFees24h_share'))).toEqual([
			undefined,
			undefined,
			undefined
		])
	})

	test('uses the algebraic canonical total so signed contributions sum to 100%', () => {
		const totals = buildChainShareTotals([chain('Positive', 100), chain('Adjustment', -20), chain('Unknown', null)])

		expect(totals.totalFees24h).toBe(80)
		expect(getChainMetricShare(100, totals.totalFees24h)).toBe(125)
		expect(getChainMetricShare(-20, totals.totalFees24h)).toBe(-25)
	})

	test('preserves measured zero and keeps null or non-positive denominators unavailable', () => {
		expect(getChainMetricShare(0, 10)).toBe(0)
		expect(getChainMetricShare(null, 10)).toBeNull()
		expect(getChainMetricShare(0, 0)).toBeNull()
		expect(getChainMetricShare(-1, -1)).toBeNull()
	})
})
