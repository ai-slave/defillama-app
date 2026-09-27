import { readSelectionFromQuery } from '~/components/Select/query'
import type { ExcludeQueryKey } from '~/components/Select/types'
import { FDV_RANGES, LISTING_STATUS_LABELS } from './constants'
import type { UtrLeaderboardRow } from './types'

type UtrQuery = Readonly<Record<string, string | Array<string> | undefined>>

export const UTR_FILTER_KEYS = {
	fdv: { include: 'fdv', exclude: 'excludeFdv', all: FDV_RANGES.map((range) => range.key) },
	sector: { include: 'sector', exclude: 'excludeSector' },
	listing: { include: 'listing', exclude: 'excludeListing', all: Object.keys(LISTING_STATUS_LABELS) }
} as const satisfies Record<string, { include: string; exclude: ExcludeQueryKey; all?: ReadonlyArray<string> }>

export type UtrFilters = {
	fdvRanges: Array<string>
	sectors: Array<string>
	listingStatuses: Array<string>
}

export function readUtrFilters(query: UtrQuery, sectorOptions: Array<string>): UtrFilters {
	const { fdv, sector, listing } = UTR_FILTER_KEYS
	return {
		fdvRanges: readSelectionFromQuery(query, fdv.include, fdv.exclude, fdv.all),
		sectors: readSelectionFromQuery(query, sector.include, sector.exclude, sectorOptions),
		listingStatuses: readSelectionFromQuery(query, listing.include, listing.exclude, listing.all)
	}
}

/** Rows without an FDV or a sector pass only while that filter selects every option. */
export function filterUtrRows(
	rows: Array<UtrLeaderboardRow>,
	{ fdvRanges, sectors, listingStatuses }: UtrFilters,
	sectorOptions: Array<string>
): Array<UtrLeaderboardRow> {
	const allFdv = fdvRanges.length === FDV_RANGES.length
	const allSectors = sectors.length === sectorOptions.length
	const ranges = FDV_RANGES.filter((range) => fdvRanges.includes(range.key))
	const sectorSet = new Set(sectors)
	const statusSet = new Set<string>(listingStatuses)
	const filtered: Array<UtrLeaderboardRow> = []
	for (const row of rows) {
		const fdv = row.fdvUsd
		if (fdv == null ? !allFdv : !ranges.some((range) => fdv >= range.min && fdv < range.max)) continue
		if (row.sector == null ? !allSectors : !sectorSet.has(row.sector)) continue
		if (!statusSet.has(row.listingStatus)) continue
		filtered.push(row)
	}
	return filtered
}
