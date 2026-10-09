import { assignUniqueColors, CHART_COLORS } from '~/constants/colors'
import type { MultiSeriesChartArrayRow, MultiSeriesChartSeriesConfig } from './types'

// A band under 1% of its row is a sliver: it cannot be mistaken for a neighbour, so it adds no overlap.
const VISIBLE_SHARE = 0.01

const PALETTE_INDEX = new Map(CHART_COLORS.map((color, index) => [color, index]))

/**
 * Palette colours for a stack's drawn series. In draw order, a series keeps its colour unless an earlier one took it:
 * past CHART_SERIES_LIMIT ranks, or with a series picked from past them, the palette cycles. While the drawn series fit
 * the palette, repeats take the unused colours in draw order (`assignUniqueColors`), the rule a pie beside the chart
 * follows, so both colour the same picks alike. Past the palette, each repeat, largest area first, takes the palette
 * colour it overlaps least with: overlap is the smaller share of two series summed over the rows where both are
 * visible, so series that never appear together share a colour and series that fill the chart together do not. Brand
 * and meaning colours are not palette colours and keep their own. Returns the colours that change, by series name, or
 * null when nothing changes.
 */
export function assignStackColors({
	charts,
	stack,
	source
}: {
	/** The renderer's charts in order, with numeric `encode.y` columns into `source`. */
	charts: ReadonlyArray<MultiSeriesChartSeriesConfig>
	stack: ReadonlySet<string>
	source: ReadonlyArray<MultiSeriesChartArrayRow>
}): Map<string, string> | null {
	const names: Array<string> = []
	const columns: Array<number> = []
	const palettes: Array<number> = []
	const colorIndex: Array<number> = []
	const uses = new Array<number>(CHART_COLORS.length).fill(0)
	const repeated: Array<number> = []
	for (let index = 0; index < charts.length; index++) {
		const chart = charts[index]!
		if (!stack.has(chart.name)) continue
		// The renderer's own fallback for a series without a colour.
		const palette = PALETTE_INDEX.get(chart.color ?? CHART_COLORS[index % CHART_COLORS.length]!)
		if (palette === undefined) continue
		// A series with its own points shares no rows with the stack, so its overlap is unknown.
		if (chart.data) return null
		const column = Array.isArray(chart.encode.y) ? chart.encode.y[0] : chart.encode.y
		if (typeof column !== 'number') return null
		if (uses[palette] === 0) {
			uses[palette]++
			colorIndex.push(palette)
		} else {
			repeated.push(names.length)
			colorIndex.push(-1)
		}
		names.push(chart.name)
		columns.push(column)
		palettes.push(palette)
	}
	if (repeated.length === 0) return null
	const count = names.length

	if (count <= CHART_COLORS.length) {
		const unique = assignUniqueColors(names.map((name, member) => ({ name, color: CHART_COLORS[palettes[member]!]! })))
		const colors = new Map<string, string>()
		for (const member of repeated) colors.set(names[member]!, unique[names[member]!]!)
		return colors
	}

	// One pass over the rows: each series' total share (its area) and the overlap of every pair visible together.
	const area = new Float64Array(count)
	// Sparse, by series: most pairs never show together, and a stack can hold hundreds of series.
	const overlap = Array.from({ length: count }, () => new Map<number, number>())
	const shares = new Float64Array(count)
	const visible: Array<number> = []
	for (const row of source) {
		let total = 0
		for (let member = 0; member < count; member++) {
			// Null, '-' and missing cells draw nothing (NaN is falsy); negative bands stack down by magnitude.
			const value = Math.abs(Number(row[columns[member]!])) || 0
			shares[member] = value
			total += value
		}
		if (total === 0) continue
		visible.length = 0
		for (let member = 0; member < count; member++) {
			const share = shares[member]! / total
			shares[member] = share
			area[member]! += share
			if (share >= VISIBLE_SHARE) visible.push(member)
		}
		for (let a = 0; a < visible.length; a++) {
			const first = visible[a]!
			for (let b = a + 1; b < visible.length; b++) {
				const second = visible[b]!
				const weight = Math.min(shares[first]!, shares[second]!)
				overlap[first]!.set(second, (overlap[first]!.get(second) ?? 0) + weight)
				overlap[second]!.set(first, (overlap[second]!.get(first) ?? 0) + weight)
			}
		}
	}

	repeated.sort((a, b) => area[b]! - area[a]!)
	const cost = new Float64Array(CHART_COLORS.length)
	const colors = new Map<string, string>()
	for (const member of repeated) {
		cost.fill(0)
		for (const [other, weight] of overlap[member]!) {
			const otherColor = colorIndex[other]!
			if (otherColor >= 0) cost[otherColor]! += weight
		}
		// Ties (most often slivers that overlap nothing) go to the least-used colour, so they spread.
		let best = 0
		for (let color = 1; color < CHART_COLORS.length; color++) {
			if (cost[color]! < cost[best]! || (cost[color] === cost[best] && uses[color]! < uses[best]!)) best = color
		}
		colorIndex[member] = best
		uses[best]!++
		colors.set(names[member]!, CHART_COLORS[best]!)
	}
	return colors
}
