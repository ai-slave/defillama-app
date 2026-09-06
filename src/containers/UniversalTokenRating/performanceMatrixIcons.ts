import type { UtrLeaderboardRow } from './types'

export type MatrixIconMap = Record<string, string | null | undefined>

export function areMatrixIconsReady(rows: Array<UtrLeaderboardRow>, icons: MatrixIconMap): boolean {
	return rows.every((row) => !row.iconDataUrl || Object.hasOwn(icons, row.asset))
}
