import { describe, expect, test } from 'vitest'
import {
	syncUtrLeaderboardPaging,
	type UtrFocusRequest,
	type UtrLeaderboardPaging,
	type UtrLeaderboardSelections
} from '../navigation'
import type { UtrLeaderboardRow } from '../types'

// Paging only reads the asset order, so rows carry nothing else.
const rows = (count: number, from = 0) =>
	Array.from({ length: count }, (_, index) => ({ asset: `asset-${from + index}` }) as UtrLeaderboardRow)
const allRows = rows(205)

const selections: UtrLeaderboardSelections = {
	fdvRanges: ['small', 'large'],
	sectors: ['DeFi', 'L1'],
	listingStatuses: ['listed', 'unlisted'],
	sort: { key: 'rank', desc: false }
}
const searchedAsset150: UtrFocusRequest = { asset: 'asset-150', nonce: 1 }
const firstPage: UtrLeaderboardPaging = { page: 0, selections, focusRequest: undefined }
const onSearchedPage: UtrLeaderboardPaging = { page: 1, selections, focusRequest: searchedAsset150 }

describe('leaderboard paging', () => {
	test('a search jumps to the page holding the token', () => {
		expect(syncUtrLeaderboardPaging(firstPage, allRows, selections, searchedAsset150).page).toBe(1)
	})

	test('a search for a token outside the rows keeps the page', () => {
		expect(syncUtrLeaderboardPaging(firstPage, allRows, selections, { asset: 'missing', nonce: 1 }).page).toBe(0)
	})

	test('re-sorting returns to the first page instead of chasing the searched token', () => {
		const sorted = { ...selections, sort: { key: 'rank', desc: true } }
		expect(syncUtrLeaderboardPaging(onSearchedPage, [...allRows].reverse(), sorted, searchedAsset150).page).toBe(0)
	})

	test('changing filters returns to the first page', () => {
		const filtered = { ...selections, fdvRanges: ['large'] }
		expect(syncUtrLeaderboardPaging(onSearchedPage, rows(155, 50), filtered, searchedAsset150).page).toBe(0)
	})

	test('an unrelated re-render or refreshed rows keep the current page', () => {
		const sameSelections = { ...selections, sort: { ...selections.sort } }
		expect(syncUtrLeaderboardPaging(onSearchedPage, allRows, sameSelections, searchedAsset150)).toBe(onSearchedPage)
		expect(syncUtrLeaderboardPaging(onSearchedPage, rows(205), sameSelections, searchedAsset150)).toBe(onSearchedPage)
	})

	test('a shorter refreshed list clamps the page without jumping back when it grows', () => {
		const lastPage = { ...onSearchedPage, page: 2 }
		const clamped = syncUtrLeaderboardPaging(lastPage, allRows.slice(0, 150), selections, searchedAsset150)
		expect(clamped.page).toBe(1)
		expect(syncUtrLeaderboardPaging(clamped, allRows, selections, searchedAsset150).page).toBe(1)
	})

	test('a search wins when it also restores filters and sorting', () => {
		const narrowed = {
			page: 0,
			selections: { ...selections, sectors: ['DeFi'], sort: { key: 'rank', desc: true } },
			focusRequest: undefined
		}
		expect(syncUtrLeaderboardPaging(narrowed, allRows, selections, searchedAsset150)).toEqual({
			page: 1,
			selections,
			focusRequest: searchedAsset150
		})
	})
})
