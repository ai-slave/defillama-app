import { describe, expect, test } from 'vitest'
import { constructTestTable } from '~/components/Table/__tests__/helpers/constructTestTable'
import { searchTableFeatures as tableFeaturesConfig } from '~/components/Table/features/search'
import { buildDirectoryColumns } from '../directoryColumns'
import { directoryColumnVisibility } from '../DirectoryTable'
import type { ExchangeDirectoryRowModel } from '../models'
import type { DirectoryScope } from '../queryState'

const visibleIds = (scope: DirectoryScope) =>
	Object.entries(directoryColumnVisibility('activity', scope))
		.filter(([, visible]) => visible)
		.map(([id]) => id)
		.sort()

describe('merged directory scope', () => {
	test('does not add COIN-perp values to the merged Perp columns', () => {
		const row = {
			segments: {
				linear_perp: { openInterestUsd: 100, volume24h: 80 },
				inverse_perp: { openInterestUsd: 900, volume24h: 700 }
			},
			normalizedVolume: {
				linear_perp: { activeLiquidity: 40, normalized: 60 },
				inverse_perp: null
			}
		} as unknown as ExchangeDirectoryRowModel
		const table = constructTestTable({
			features: tableFeaturesConfig,
			data: [row],
			columns: buildDirectoryColumns('all', false),
			state: {},
			renderFallbackValue: null
		})
		const value = (id: string) => {
			const cell = table
				.getRowModel()
				.rows[0]?.getAllCells()
				.find((item) => item.column.id === id)
			if (!cell) throw new Error(`Expected ${id} cell`)
			return cell.getValue()
		}

		expect(value('perpActiveLiquidity')).toBe(40)
		expect(value('perpOpenInterest')).toBe(100)
		expect(value('perpNormalizedVolume')).toBe(60)
	})

	// Links, venue type and fee schedules are one click away and none is a measurement,
	// so the merged view spends its width on the metrics instead.
	test('drops links, type and fee columns from the merged view but keeps them per segment', () => {
		for (const id of ['venueLinks', 'kind', 'spotFee', 'linearPerpFee', 'inversePerpFee']) {
			expect(visibleIds('all')).not.toContain(id)
		}
		expect(visibleIds('spot')).toContain('venueLinks')
		expect(visibleIds('spot')).toContain('kind')
		expect(visibleIds('spot')).toContain('spotFee')
		expect(visibleIds('linear_perp')).toContain('linearPerpFee')
	})

	test('shows no merged-view column that is blank for a venue with spot and USD-perp data', () => {
		const segment = {
			volume24h: 80,
			volumePrevious24h: 70,
			openInterestUsd: 100,
			openInterestPreviousUsd: 90,
			marketCount: 2,
			coinCount: 2,
			depthBidUsd: 5,
			depthAskUsd: 5
		}
		const row = {
			name: 'Venue',
			segments: { spot: segment, linear_perp: segment },
			normalizedVolume: {
				spot: { activeLiquidity: 40, normalized: 60 },
				linear_perp: { activeLiquidity: 40, normalized: 60 }
			},
			sparks: { spot: [1, 2], linear_perp: [1, 2] },
			execution: { costToTradeBps: 1, realizedSlippage10kBps: 2, markout1mBps: 3 }
		} as unknown as ExchangeDirectoryRowModel
		const visible = new Set(visibleIds('all'))
		const table = constructTestTable({
			features: tableFeaturesConfig,
			data: [row],
			columns: buildDirectoryColumns('all', true),
			state: {},
			renderFallbackValue: null
		})
		const blank = table
			.getRowModel()
			.rows[0]!.getAllCells()
			.filter((cell) => visible.has(cell.column.id) && cell.column.accessorFn && cell.getValue() == null)
			.map((cell) => cell.column.id)
		expect(blank).toEqual([])
	})

	// Fee columns are hidden from the merged metric views, but the Fees view is made
	// of them: it keeps the in-scope fees rather than rendering only Name and Fee Token.
	test('keeps spot and USD-perp fees in the merged Fees view, COIN fees out', () => {
		const visible = Object.entries(directoryColumnVisibility('fees', 'all'))
			.filter(([, isVisible]) => isVisible)
			.map(([id]) => id)
		expect(visible).toContain('spotFee')
		expect(visible).toContain('linearPerpFee')
		expect(visible).toContain('feeToken')
		expect(visible).not.toContain('inversePerpFee')
	})

	// Each segment table keeps its own liquidity column: the volatility band where a
	// normalized-volume band exists, the fixed ±2% depth for COIN perps, which have none.
	test('shows COIN perps the ±2% depth and the other segment tables the volatility band', () => {
		expect(visibleIds('inverse_perp')).toContain('depth2Usd')
		expect(visibleIds('inverse_perp')).not.toContain('activeLiquidity')
		for (const scope of ['spot', 'linear_perp'] as const) {
			expect(visibleIds(scope)).toContain('activeLiquidity')
			expect(visibleIds(scope)).not.toContain('depth2Usd')
		}
	})
})
