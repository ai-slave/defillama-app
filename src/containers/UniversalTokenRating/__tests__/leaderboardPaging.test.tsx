// @vitest-environment happy-dom

import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { UtrFocusRequest } from '../navigation'
import type { UtrLeaderboardRow } from '../types'

vi.mock('../PerformanceMatrix', () => ({ PerformanceMatrix: () => <div>Matrix</div> }))

import { Leaderboard, type UtrSort } from '../Leaderboard'

const baseRow: UtrLeaderboardRow = {
	asset: 'example',
	name: 'Example Protocol',
	symbol: 'EXP',
	sector: 'DeFi',
	listingStatus: 'listed',
	disclosureLevel: 'full',
	claimed: false,
	fdvUsd: 10_000_000,
	grade: 'AAA',
	scores: {
		overall: 60,
		overallMomChangePct: 2,
		disclosure: 8,
		performance: 7.5,
		rank: 1,
		disclosureRubrics: [],
		performanceRubrics: []
	}
}

const allRows: Array<UtrLeaderboardRow> = Array.from({ length: 205 }, (_, index) => ({
	...baseRow,
	asset: `asset-${index}`,
	name: `Protocol ${index}`,
	scores: { ...baseRow.scores, rank: index }
}))

const rankAsc: UtrSort = { key: 'rank', desc: false }
const rankDesc: UtrSort = { key: 'rank', desc: true }
const searchedAsset150: UtrFocusRequest = { asset: 'asset-150', nonce: 1 }
const filters = { fdvRanges: ['small', 'large'], sectors: ['DeFi', 'L1'], listingStatuses: ['listed', 'unlisted'] }

describe('leaderboard pagination follows search, sorting and filtering', () => {
	let container: HTMLDivElement
	let root: Root

	function render(element: ReactElement) {
		return act(async () => {
			root.render(element)
		})
	}

	const onPage = (asset: string) => document.getElementById(`utr-row-${asset}`) != null

	function show(rows: Array<UtrLeaderboardRow>, sort: UtrSort, focusRequest?: UtrFocusRequest, selections = filters) {
		return render(
			<Leaderboard rows={rows} sort={sort} setSort={() => undefined} focusRequest={focusRequest} {...selections} />
		)
	}

	// The page starts with no focus request and creates one when a search matches, so reaching the
	// searched page always means going through that transition rather than mounting mid-search.
	async function searchForAsset150() {
		await show(allRows, rankAsc)
		await show(allRows, rankAsc, searchedAsset150)
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('a search jumps to the page holding the token', async () => {
		await show(allRows, rankAsc)
		expect(onPage('asset-150')).toBe(false)

		await show(allRows, rankAsc, searchedAsset150)
		expect(onPage('asset-150')).toBe(true)
		expect(onPage('asset-0')).toBe(false)
	})

	test('re-sorting returns to the first page instead of chasing the searched token', async () => {
		await searchForAsset150()
		expect(onPage('asset-150')).toBe(true)

		await show(allRows, rankDesc, searchedAsset150)
		// Descending rank puts 204 first; 104 sits at index 100, so it is only reachable on the second page.
		expect(onPage('asset-204')).toBe(true)
		expect(onPage('asset-104')).toBe(false)
	})

	test('changing filters returns to the first page', async () => {
		await searchForAsset150()
		expect(onPage('asset-0')).toBe(false)

		await show(
			allRows.filter((row) => row.scores.rank >= 50),
			rankAsc,
			searchedAsset150,
			{ ...filters, fdvRanges: ['large'] }
		)
		expect(onPage('asset-50')).toBe(true)
		expect(onPage('asset-149')).toBe(true)
		expect(onPage('asset-150')).toBe(false)
	})

	test('an unrelated re-render keeps the current page', async () => {
		await searchForAsset150()
		expect(onPage('asset-150')).toBe(true)

		await show(allRows, rankAsc, searchedAsset150)
		expect(onPage('asset-150')).toBe(true)
		expect(onPage('asset-0')).toBe(false)
	})

	test('refreshed numbers update without resetting the page', async () => {
		await searchForAsset150()

		await show(
			allRows.map((row) => ({ ...row, fdvUsd: 42 })),
			{ ...rankAsc },
			searchedAsset150
		)
		expect(onPage('asset-0')).toBe(false)
		expect(document.getElementById('utr-row-asset-150')?.textContent).toContain('$42')
	})

	test('a shorter refreshed list clamps the page without jumping back when it grows', async () => {
		await searchForAsset150()
		await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.click())
		expect(onPage('asset-204')).toBe(true)

		await show(allRows.slice(0, 150), rankAsc, searchedAsset150)
		expect(onPage('asset-100')).toBe(true)
		expect(onPage('asset-149')).toBe(true)
		expect(onPage('asset-0')).toBe(false)

		await show(allRows, rankAsc, searchedAsset150)
		expect(onPage('asset-100')).toBe(true)
		expect(onPage('asset-204')).toBe(false)
	})

	test('a search wins when it also restores filters and sorting', async () => {
		await show(allRows.slice(0, 100), rankDesc, undefined, { ...filters, sectors: ['DeFi'] })

		await show(allRows, rankAsc, searchedAsset150)
		expect(onPage('asset-150')).toBe(true)
		expect(onPage('asset-0')).toBe(false)
	})
})
