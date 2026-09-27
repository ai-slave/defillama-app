import { describe, expect, test } from 'vitest'
import { getQueryUpdatesFromSelected } from '~/components/Select/query'
import { filterUtrRows, readUtrFilters, UTR_FILTER_KEYS } from '../filters'
import type { UtrLeaderboardRow } from '../types'

const row = (asset: string, fields: Partial<UtrLeaderboardRow>) =>
	({ asset, sector: 'DeFi', listingStatus: 'listed', fdvUsd: 50_000_000, ...fields }) as UtrLeaderboardRow

const rows = [
	row('aave', { sector: 'DeFi', fdvUsd: 2_000_000_000 }),
	row('axie', { sector: 'Gaming', listingStatus: 'unlisted' }),
	row('fartcoin', { sector: 'Memecoins', listingStatus: 'pre-tge' }),
	row('mystery', { sector: null, fdvUsd: null })
]
const sectorOptions = ['DeFi', 'Gaming', 'Memecoins']

function visibleAfter(query: Record<string, string | Array<string> | undefined>) {
	return filterUtrRows(rows, readUtrFilters(query, sectorOptions), sectorOptions).map((entry) => entry.asset)
}

describe('Universal Token Rating URL filters', () => {
	test('no filter in the URL keeps every row, including rows without a sector or FDV', () => {
		expect(visibleAfter({})).toEqual(['aave', 'axie', 'fartcoin', 'mystery'])
	})

	test('sectors picked in the picker filter the rows after a reload', () => {
		const { include, exclude } = UTR_FILTER_KEYS.sector
		expect(visibleAfter(getQueryUpdatesFromSelected(include, exclude, sectorOptions, ['DeFi', 'Gaming']))).toEqual([
			'aave',
			'axie'
		])
	})

	test('leaving out one FDV range and one listing status drops rows in them and rows without an FDV', () => {
		const fdv = UTR_FILTER_KEYS.fdv
		const listing = UTR_FILTER_KEYS.listing
		const query = {
			...getQueryUpdatesFromSelected(fdv.include, fdv.exclude, [...fdv.all], ['micro', 'small', 'mid']),
			...getQueryUpdatesFromSelected(listing.include, listing.exclude, [...listing.all], ['listed', 'unlisted'])
		}
		expect(query).toEqual({ excludeFdv: 'large', fdv: undefined, excludeListing: 'pre-tge', listing: undefined })
		expect(visibleAfter(query)).toEqual(['axie'])
	})
})
