import { createTable, getCoreRowModel } from '@tanstack/react-table'
import { describe, expect, test } from 'vitest'
import { buildDirectoryColumns, EXECUTION_COLUMN_IDS } from '../directoryColumns'
import { directoryColumnVisibility } from '../DirectoryTable'
import type { ExchangeDirectoryRowModel } from '../models'
import { DIRECTORY_ALL_SEGMENTS, type DirectoryScope } from '../queryState'

const visibleIds = (scope: DirectoryScope) =>
	Object.entries(directoryColumnVisibility('activity', scope))
		.filter(([, visible]) => visible)
		.map(([id]) => id)
		.sort()

const MERGED_ONLY = [
	'spotActiveLiquidity',
	'perpActiveLiquidity',
	'perpOpenInterest',
	'spotNormalizedVolume',
	'perpNormalizedVolume'
]

describe('merged directory scope', () => {
	test('merges spot and USD perps only — COIN perps stay in their own table', () => {
		expect(DIRECTORY_ALL_SEGMENTS).toEqual(['spot', 'linear_perp'])
	})

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
		const table = createTable({
			data: [row],
			columns: buildDirectoryColumns('all', false),
			getCoreRowModel: getCoreRowModel(),
			state: {},
			onStateChange: () => {},
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

	// The point of the merged view is a row that fits without horizontal scroll and
	// leads with measured metrics. Pinned so adding a column stays a decision rather
	// than drift.
	test('shows one segment-qualified set plus the execution metrics, and nothing else', () => {
		expect(visibleIds('all')).toEqual([...MERGED_ONLY, ...EXECUTION_COLUMN_IDS].sort())
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

	test('drops every column that would have no segment to read in the merged view', () => {
		const visible = visibleIds('all')
		for (const id of [
			'activeLiquidity',
			'depth2Usd',
			'volume24h',
			'volumeChange24h',
			'normalizedVolume',
			'openInterestUsd',
			'openInterestChange24h',
			'volumeToOi',
			'volumeToDepth',
			'sparkline',
			'marketCount',
			'coinCount'
		]) {
			expect(visible).not.toContain(id)
		}
		// COIN perps are out of scope here, including their fee column.
		expect(visible).not.toContain('inversePerpFee')
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

	test('leaves the exact-segment tables untouched by the merged columns', () => {
		for (const scope of ['spot', 'linear_perp', 'inverse_perp'] as const) {
			const visible = visibleIds(scope)
			for (const id of MERGED_ONLY) expect(visible).not.toContain(id)
			// Each segment table keeps the liquidity column it had: the volatility band
			// where a normalized-volume band exists, the fixed ±2% depth for COIN perps.
			expect(visible).toContain(scope === 'inverse_perp' ? 'depth2Usd' : 'activeLiquidity')
			expect(visible).toContain('volume24h')
		}
	})
})
