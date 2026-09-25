import { describe, expect, test } from 'vitest'
import { constructTestTable } from '~/components/Table/__tests__/helpers/constructTestTable'
import { searchTableOptions } from '~/components/Table/features/searchHook'
import { TRADFI_API } from '~/constants'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { toUnixMsTimestamp } from './api'
import type { IDATInstitutionDetailResponse, IDATInstitutionsResponse, IDATTransaction } from './api.types'
import { datTransactionColumns } from './Company'
import { buildDATTransactionRowsByAsset, getDATCompanyData, getDATOverviewData } from './queries'
import type { IDATTransactionRow } from './types'

const http = installFixtureFetch()

describe('toUnixMsTimestamp', () => {
	test('normalizes documented numeric second timestamps without changing millisecond timestamps', () => {
		expect(toUnixMsTimestamp(1_767_225_600)).toBe(1_767_225_600_000)
		expect(toUnixMsTimestamp(1_767_225_600_000)).toBe(1_767_225_600_000)
	})
})

function transaction(overrides: Partial<IDATTransactionRow>): IDATTransactionRow {
	return {
		id: 1,
		asset: 'bitcoin',
		amount: 1,
		avg_price: 100,
		usd_value: 100,
		start_date: '2026-01-01',
		end_date: '2026-01-01',
		report_date: '2026-01-02',
		type: 'purchase',
		source_type: '',
		source_url: '',
		source_note: '',
		is_approved: true,
		reject_reason: null,
		last_updated: '',
		ticker: '',
		assetName: '',
		assetTicker: '',
		...overrides
	}
}

describe('buildDATTransactionRowsByAsset', () => {
	test('plots each asset oldest-first from the newest-first API response', () => {
		const result = buildDATTransactionRowsByAsset([
			transaction({ id: 3, end_date: '2026-01-03', amount: 3, avg_price: 300, usd_value: 900 }),
			transaction({ id: 2, asset: 'ethereum', end_date: '2026-01-02', amount: 2 }),
			transaction({ id: 1, end_date: '2026-01-01', amount: 1 })
		])

		expect(result.get('bitcoin')).toEqual([
			[Date.parse('2026-01-01') / 1000, 1, 100, 100],
			[Date.parse('2026-01-03') / 1000, 3, 300, 900]
		])
		expect(result.get('ethereum')).toEqual([[Date.parse('2026-01-02') / 1000, 2, 100, 100]])
	})

	test('keeps sales negative and preserves decimal prices and values', () => {
		const result = buildDATTransactionRowsByAsset([
			transaction({ type: 'sale', amount: 2.5, avg_price: 12.25, usd_value: 30.625 })
		])

		expect(result.get('bitcoin')?.[0].slice(1)).toEqual([-2.5, 12.25, 30.625])
	})

	test('sorts only an asset whose mostly newest-first response contains a local inversion', () => {
		const result = buildDATTransactionRowsByAsset([
			transaction({ id: 4, end_date: '2026-01-04', amount: 4 }),
			transaction({ id: 2, end_date: '2026-01-02', amount: 2 }),
			transaction({ id: 3, end_date: '2026-01-03', amount: 3 }),
			transaction({ id: 1, end_date: '2026-01-01', amount: 1 })
		])

		expect(result.get('bitcoin')?.map((item) => item[0])).toEqual([
			Date.parse('2026-01-01') / 1000,
			Date.parse('2026-01-02') / 1000,
			Date.parse('2026-01-03') / 1000,
			Date.parse('2026-01-04') / 1000
		])
	})
})

describe('getDATCompanyData transaction rows', () => {
	const transactions: Array<IDATTransaction> = [
		{ ...transaction({ id: 1 }), amount: '2.5', avg_price: '9.50', usd_value: '80800000.00' },
		{ ...transaction({ id: 2 }), amount: '3', avg_price: '100.00', usd_value: '2010000000.00' },
		{ ...transaction({ id: 3 }), amount: '0', avg_price: '0', usd_value: '0' },
		{ ...transaction({ id: 4 }), amount: '1', avg_price: null, usd_value: null },
		{ ...transaction({ id: 5, type: 'sale' }), amount: '1.25', avg_price: '9.12', usd_value: '2500000.00' }
	]
	const response: IDATInstitutionDetailResponse = {
		institutionId: 1,
		ticker: 'MSTR',
		name: 'Strategy',
		type: 'company',
		rank: 1,
		price: 100,
		priceChange24h: null,
		volume24h: 0,
		totalCost: 100,
		totalUsdValue: 100,
		assets: { bitcoin: { amount: 1, avgPrice: 100, usdValue: 100, cost: 100 } },
		assetsMeta: { bitcoin: { name: 'Bitcoin', ticker: 'BTC' } },
		ohlcv: [],
		assetValue: [],
		stats: [],
		transactions,
		lastUpdated: '2026-01-02'
	}

	test('converts API strings once for table and chart data without turning null into zero', async () => {
		http.serve({ [`${TRADFI_API}/institutions/mstr`]: response })
		const result = (await getDATCompanyData('mstr'))!

		expect(result.transactions.map(({ amount, avg_price, usd_value }) => [amount, avg_price, usd_value])).toEqual([
			[2.5, 9.5, 80_800_000],
			[3, 100, 2_010_000_000],
			[0, 0, 0],
			[1, null, null],
			[1.25, 9.12, 2_500_000]
		])
		expect(result.chartByAsset[0].holdingsChart.dataset.source).toEqual([
			[Date.parse('2026-01-01'), -1.25, -1.25, 9.12, 2_500_000],
			[Date.parse('2026-01-01'), -0.25, 1, null, null],
			[Date.parse('2026-01-01'), -0.25, 0, 0, 0],
			[Date.parse('2026-01-01'), 2.75, 3, 100, 2_010_000_000],
			[Date.parse('2026-01-01'), 5.25, 2.5, 9.5, 80_800_000]
		])
		expect(response.transactions[0].avg_price).toBe('9.50')
	})

	test.each(['avg_price', 'usd_value'])(
		'sorts %s numerically in both directions with missing values last',
		async (id) => {
			http.serve({ [`${TRADFI_API}/institutions/mstr`]: response })
			const { transactions: rows } = (await getDATCompanyData('mstr'))!

			for (const desc of [false, true]) {
				const table = constructTestTable({
					...searchTableOptions,
					data: rows,
					columns: datTransactionColumns,
					state: { sorting: [{ id, desc }] },
					renderFallbackValue: null
				})
				expect(table.getSortedRowModel().rows.map((row) => row.original.id)).toEqual(
					desc ? [2, 1, 5, 3, 4] : [3, 5, 1, 2, 4]
				)
			}
		}
	)
})

test('retains asset IDs through duplicate labels, valuation sorting and renaming', async () => {
	const holding = {
		amount: 1,
		avgPrice: 10,
		usdValue: 10,
		cost: 10,
		transactionCount: 1,
		firstAnnouncementDate: '',
		lastAnnouncementDate: '',
		supplyPercentage: 0
	}
	const assetMetadata = {
		name: 'Same asset',
		ticker: 'SAME',
		geckoId: '',
		companies: 1,
		totalAmount: 1,
		totalUsdValue: 10,
		circSupplyPerc: 0
	}
	const response: IDATInstitutionsResponse = {
		institutionMetadata: {
			'1': {
				institutionId: 1,
				ticker: 'CO',
				name: 'Company',
				type: '',
				price: 1,
				priceChange24h: null,
				volume24h: 0,
				mcapRealized: null,
				mcapRealistic: null,
				mcapMax: null,
				realized_mNAV: null,
				realistic_mNAV: null,
				max_mNAV: null,
				totalUsdValue: 30,
				totalCost: 20,
				holdings: { first: holding, second: { ...holding, usdValue: 20 } }
			}
		},
		assetMetadata: { first: assetMetadata, second: assetMetadata },
		institutions: [{ institutionId: 1, totalUsdValue: 30, totalCost: 20 }],
		assets: { first: [], second: [] },
		totalCompanies: 1,
		flows: {},
		mNAV: {}
	}
	http.serve({ [`${TRADFI_API}/institutions`]: response })
	expect(
		(await getDATOverviewData()).institutions[0].holdings.map(({ asset, name, usdValue }) => ({
			asset,
			name,
			usdValue
		}))
	).toEqual([
		{ asset: 'second', name: 'Same asset', usdValue: 20 },
		{ asset: 'first', name: 'Same asset', usdValue: 10 }
	])
	http.serve({
		[`${TRADFI_API}/institutions`]: {
			...response,
			assetMetadata: { ...response.assetMetadata, first: { ...assetMetadata, name: 'Renamed' } },
			institutionMetadata: {
				'1': {
					...response.institutionMetadata['1'],
					holdings: { first: { ...holding, usdValue: 30 }, second: holding }
				}
			}
		}
	})
	expect((await getDATOverviewData()).institutions[0].holdings.map(({ asset, name }) => ({ asset, name }))).toEqual([
		{ asset: 'first', name: 'Renamed' },
		{ asset: 'second', name: 'Same asset' }
	])
})
