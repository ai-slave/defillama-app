import { describe, expect, test } from 'vitest'
import { constructTestTable } from '~/components/Table/__tests__/helpers/constructTestTable'
import { searchTableFeatures } from '~/components/Table/features/search'
import { buildDirectoryColumns } from '../directoryColumns'
import type { ExchangeDirectoryRowModel, ExchangeSegmentActivity } from '../models'

function activity(patch: Partial<ExchangeSegmentActivity> = {}): ExchangeSegmentActivity {
	return {
		marketCount: 2,
		coinCount: 2,
		volume24h: 100,
		volumePrevious24h: null,
		openInterestUsd: null,
		openInterestPreviousUsd: null,
		depthBidUsd: null,
		depthAskUsd: null,
		depthPartial: false,
		depthLadder: null,
		volumeUpdatedAt: '2026-07-14T12:00:00Z',
		supportsOpenInterest: false,
		supportsDepth: false,
		...patch
	}
}

function row(patch: Partial<ExchangeDirectoryRowModel> = {}): ExchangeDirectoryRowModel {
	return {
		slug: 'venue',
		name: 'Venue',
		kind: 'cex',
		tracked: true,
		totalVolume24h: null,
		profileHref: '/exchange/venue',
		secondaryUrl: null,
		reservesHref: null,
		websiteUrl: null,
		referralUrl: null,
		related: { euEntity: null, globalEntity: null },
		parent: null,
		liquidity: { spot: { mode: 'own' }, linear_perp: null, inverse_perp: null },
		segments: {},
		sparks: {},
		reserves: null,
		fees: null,
		compliance: null,
		profile: null,
		funding: null,
		warnings: [],
		regional: null,
		selectedCountry: null,
		selectedCountryStatus: null,
		normalizedVolume: null,
		execution: null,
		quality: null,
		...patch
	}
}

function quality(score: number, rank: number): NonNullable<ExchangeDirectoryRowModel['quality']> {
	return { score, rank, tier: 'A', segments: {}, components: {} }
}

function directoryCell(scope: 'spot' | 'linear_perp' | 'inverse_perp', venue: ExchangeDirectoryRowModel, id: string) {
	const table = constructTestTable({
		features: searchTableFeatures,
		data: [venue],
		columns: buildDirectoryColumns(scope, true),
		state: {},
		renderFallbackValue: null
	})
	const cell = table
		.getRowModel()
		.rows[0]?.getAllCells()
		.find((item) => item.column.id === id)
	if (!cell) throw new Error(`Expected ${id} cell`)
	return cell
}

describe('exact segment scopes in directory columns', () => {
	test('hides execution columns only when the execution source is unavailable', () => {
		const availableIds = new Set(buildDirectoryColumns('linear_perp', true).map((column) => column.id))
		const unavailableIds = new Set(buildDirectoryColumns('linear_perp', false).map((column) => column.id))

		const execIds = ['execCostToTrade', 'execSlippage10k', 'execMarkout1m']
		expect(execIds.filter((id) => availableIds.has(id))).toEqual(execIds)
		expect(execIds.filter((id) => unavailableIds.has(id))).toEqual([])
	})

	test('exports blank execution cells for a venue without measured fills', () => {
		const columns = buildDirectoryColumns('linear_perp', true)
		for (const id of ['execCostToTrade', 'execSlippage10k', 'execMarkout1m']) {
			const column = columns.find((item) => item.id === id)
			if (!column) throw new Error(`Expected ${id} column`)
			expect(column.meta?.csvValue?.(row())).toBe('')
		}
	})

	test('never renders a summed perp figure for a venue with both perpetual classes', () => {
		const venue = row({
			segments: {
				linear_perp: activity({ volume24h: 600 }),
				inverse_perp: activity({ volume24h: 25 })
			}
		})

		expect(directoryCell('linear_perp', venue, 'volume24h').getValue()).toBe(600)
		expect(directoryCell('inverse_perp', venue, 'volume24h').getValue()).toBe(25)
		expect(directoryCell('spot', venue, 'volume24h').getValue()).toBeUndefined()
	})

	// Sorting by any other column is a one-way trip unless the name column can restore
	// the ranked order the table opens with.
	test('sorts the Exchange column by quality rank, best first, not by name', () => {
		const column = buildDirectoryColumns('spot', true).find((candidate) => candidate.id === 'name')
		const sortFn = column?.sortFn
		expect(typeof sortFn).toBe('function')
		expect(column?.enableSorting).not.toBe(false)
		expect(column?.sortDescFirst).toBe(false)

		const best = { original: row({ name: 'Alpha', quality: quality(90, 1) }) }
		const worst = { original: row({ name: 'Zeta', quality: quality(20, 2) }) }
		const unranked = { original: row({ name: 'Beta', totalVolume24h: 10 }) }
		const compare = sortFn as (a: typeof best, b: typeof best, id: string) => number

		expect(compare(best, worst, 'name')).toBeLessThan(0)
		expect(compare(worst, best, 'name')).toBeGreaterThan(0)
		// Unranked venues sink under both, whichever side of the comparison they are on.
		expect(compare(unranked, worst, 'name')).toBeGreaterThan(0)
		expect(compare(worst, unranked, 'name')).toBeLessThan(0)
	})
})
