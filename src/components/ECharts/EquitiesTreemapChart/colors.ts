export const EQUITIES_TREEMAP_COLORS = {
	negative: '#942e38',
	neutral: '#aaaaaa',
	positive: '#269f3c'
} as const

const COLOR_CAP_PCT = 3

function hexToRgb(hex: string): [number, number, number] {
	return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

const NEGATIVE_RGB = hexToRgb(EQUITIES_TREEMAP_COLORS.negative)
const NEUTRAL_RGB = hexToRgb(EQUITIES_TREEMAP_COLORS.neutral)
const POSITIVE_RGB = hexToRgb(EQUITIES_TREEMAP_COLORS.positive)

function mixRgb(from: [number, number, number], to: [number, number, number], t: number): string {
	const red = Math.round(from[0] + (to[0] - from[0]) * t)
	const green = Math.round(from[1] + (to[1] - from[1]) * t)
	const blue = Math.round(from[2] + (to[2] - from[2]) * t)
	return `rgb(${red}, ${green}, ${blue})`
}

export function getEquitiesTreemapColor(changePct: number | null): string {
	if (changePct == null || changePct === 0) return EQUITIES_TREEMAP_COLORS.neutral
	const intensity = Math.min(Math.abs(changePct) / COLOR_CAP_PCT, 1)
	return changePct > 0 ? mixRgb(NEUTRAL_RGB, POSITIVE_RGB, intensity) : mixRgb(NEGATIVE_RGB, NEUTRAL_RGB, 1 - intensity)
}
