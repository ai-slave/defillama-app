import { formatNumber } from '~/utils/numberFormat'
import type { UtrClaimProjectOption, UtrLeaderboardRow } from './types'

export const UTR_LEADERBOARD_PAGE_SIZE = 100

export type UtrFocusRequest = { asset: string; nonce: number }

export function resolveRequestedProjectId(
	projects: Array<UtrClaimProjectOption>,
	requested: string | null | undefined
): string | null {
	const normalized = requested?.trim().toLowerCase()
	if (!normalized) return null
	return (
		projects.find((project) =>
			[project.arcticId, project.coingeckoId, project.projectName, project.symbol].some(
				(value) => value?.trim().toLowerCase() === normalized
			)
		)?.arcticId ?? null
	)
}

const values = (row: UtrLeaderboardRow) =>
	[row.name, row.symbol, row.asset, `${row.name} (${row.symbol})`].map((value) => value.toLowerCase())

export function findUtrSearchMatch(rows: Array<UtrLeaderboardRow>, query: string): UtrLeaderboardRow | null {
	const normalized = query.trim().toLowerCase()
	if (!normalized) return null
	return (
		rows.find((row) => values(row).some((value) => value === normalized)) ??
		rows.find((row) => values(row).some((value) => value.startsWith(normalized))) ??
		rows.find((row) => values(row).some((value) => value.includes(normalized))) ??
		null
	)
}

export function pageForUtrAsset(rows: Array<UtrLeaderboardRow>, asset: string): number | null {
	const index = rows.findIndex((row) => row.asset === asset)
	return index === -1 ? null : Math.floor(index / UTR_LEADERBOARD_PAGE_SIZE)
}

export type UtrLeaderboardSelections = {
	fdvRanges: Array<string>
	sectors: Array<string>
	listingStatuses: Array<string>
	sort: { key: string; desc: boolean }
}

export type UtrLeaderboardPaging = {
	page: number
	selections: UtrLeaderboardSelections
	focusRequest: UtrFocusRequest | null | undefined
}

/**
 * Carries the leaderboard page across renders. Only new filter selections or a new sort reset to the
 * first page; refreshed rows keep the page. A new focus request then pages to its asset, so a search
 * that also restores the default filters lands on the token. The page is clamped to the rows present.
 * Returns `paging` itself when nothing changed.
 */
export function syncUtrLeaderboardPaging(
	paging: UtrLeaderboardPaging,
	sortedRows: Array<UtrLeaderboardRow>,
	selections: UtrLeaderboardSelections,
	focusRequest: UtrFocusRequest | null | undefined
): UtrLeaderboardPaging {
	const previous = paging.selections
	const selectionsChanged =
		selections.fdvRanges !== previous.fdvRanges ||
		selections.sectors !== previous.sectors ||
		selections.listingStatuses !== previous.listingStatuses ||
		selections.sort.key !== previous.sort.key ||
		selections.sort.desc !== previous.sort.desc
	const focusChanged = focusRequest !== paging.focusRequest
	let page = selectionsChanged ? 0 : paging.page
	const requestedPage = focusChanged && focusRequest ? pageForUtrAsset(sortedRows, focusRequest.asset) : null
	if (requestedPage != null) page = requestedPage
	const pageCount = Math.max(1, Math.ceil(sortedRows.length / UTR_LEADERBOARD_PAGE_SIZE))
	page = Math.min(page, pageCount - 1)
	if (page === paging.page && !selectionsChanged && !focusChanged) return paging
	return { page, selections: selectionsChanged ? selections : previous, focusRequest }
}

export function formatClaimProjectStatus(project: UtrClaimProjectOption): string {
	return [
		project.tgeStatus === 'post' ? 'Listed' : 'Pre-TGE',
		project.criteriaCount ? `${project.gradedCount}/${project.criteriaCount} criteria scored` : 'Not scored',
		project.disclosureScore == null
			? null
			: `Disclosure ${formatNumber(project.disclosureScore, {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
					useGrouping: false
				})}/10`
	]
		.filter(Boolean)
		.join(' · ')
}
