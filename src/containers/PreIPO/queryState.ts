import type { ParsedUrlQuery } from 'node:querystring'
import { parseArrayParam, parseExcludeParam } from '~/utils/routerQuery'

export const PRE_IPO_SECTOR_QUERY_KEY = 'sector'
export const PRE_IPO_EXCLUDE_SECTOR_QUERY_KEY = 'excludeSector'

export function getSelectedPreIpoSectors(query: ParsedUrlQuery, sectors: Array<string>): Array<string> {
	const selected = parseArrayParam(query[PRE_IPO_SECTOR_QUERY_KEY], sectors)
	const excluded = parseExcludeParam(query[PRE_IPO_EXCLUDE_SECTOR_QUERY_KEY])
	if (selected === sectors && excluded.size === 0) return sectors

	const selectedSet = new Set(selected)
	const filtered: Array<string> = []
	for (const sector of sectors) {
		if (selectedSet.has(sector) && !excluded.has(sector)) filtered.push(sector)
	}
	return filtered
}
