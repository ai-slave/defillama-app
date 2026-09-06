import { createTable, flexRender, getCoreRowModel } from '@tanstack/react-table'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
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

function directoryCell(scope: 'spot' | 'linear_perp' | 'inverse_perp', venue: ExchangeDirectoryRowModel, id: string) {
	const table = createTable({
		data: [venue],
		columns: buildDirectoryColumns(scope, true),
		getCoreRowModel: getCoreRowModel(),
		state: {},
		onStateChange: () => {},
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
		const availableIds = buildDirectoryColumns('linear_perp', true).map((column) => column.id)
		const unavailableIds = buildDirectoryColumns('linear_perp', false).map((column) => column.id)

		expect(availableIds).toEqual(expect.arrayContaining(['execCostToTrade', 'execSlippage10k', 'execMarkout1m']))
		expect(unavailableIds).not.toEqual(expect.arrayContaining(['execCostToTrade', 'execSlippage10k', 'execMarkout1m']))
	})

	test('keeps an unmeasured venue in the available execution population', () => {
		const column = buildDirectoryColumns('linear_perp', true).find((item) => item.id === 'execCostToTrade')
		if (!column) throw new Error('Expected execution column')

		expect(column.meta?.csvValue?.(row())).toBe('')
	})

	test('keeps selected-country status out of the exchange name cell', () => {
		const venue = row({ selectedCountry: 'DE', selectedCountryStatus: 'restricted' })
		const cell = directoryCell('spot', venue, 'name')
		const html = renderToStaticMarkup(flexRender(cell.column.columnDef.cell, cell.getContext()))

		expect(venue.selectedCountryStatus).toBe('restricted')
		expect(html).not.toContain('Restricted')
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
		// 625 (600 + 25) must not be produced by any scope.
		for (const scope of ['spot', 'linear_perp', 'inverse_perp'] as const) {
			expect(directoryCell(scope, venue, 'volume24h').getValue()).not.toBe(625)
		}
	})
})
