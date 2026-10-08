import { divergingColor } from '~/constants/colors'

/** A tile takes the full rising or falling colour at a ±3% change. */
const COLOR_CAP_PCT = 3

export function getEquitiesTreemapColor(changePct: number | null): string {
	return divergingColor((changePct ?? 0) / COLOR_CAP_PCT)
}

/** The legend bar under a market treemap: loss through 0% to gain. */
export const CHANGE_SCALE_GRADIENT = `linear-gradient(to right, ${divergingColor(-1)}, ${divergingColor(0)}, ${divergingColor(1)})`
