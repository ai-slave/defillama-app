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
