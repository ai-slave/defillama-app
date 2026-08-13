import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import type { KpkComposition, KpkVault } from './api'

/** Upstream monetary fields are in $m; charts and the USD formatters want absolute dollars. */
export const MILLION = 1e6

/** The x-axis dimension of every composition dataset: month labels, plotted as categories. */
export const MONTH_DIMENSION = 'Month'

/**
 * Colour by segment name, not by position.
 *
 * `comp.segments` arrives sorted by current value, so indexing the palette by
 * position would repaint every band the moment two segments swap places. Sorting
 * the names first makes a segment's colour a function of the breakdown's
 * membership only.
 */
export function compositionColors(names: readonly string[], palette: readonly string[]): Record<string, string> {
	const colors: Record<string, string> = {}
	const sorted = [...names].sort()
	for (let i = 0; i < sorted.length; i++) {
		colors[sorted[i]] = palette[i % palette.length]
	}
	return colors
}

export interface CompositionRow {
	name: string
	/** Absolute USD. */
	valueUsd: number
	share: number
	color: string
}

export interface CompositionModel {
	title: string
	/** Absolute USD. */
	totalUsd: number
	dataset: MultiSeriesChartDataset
	charts: MultiSeriesChartSeriesConfig[]
	/** Legend/breakdown table rows, largest first — same order as the payload. */
	rows: CompositionRow[]
}

/** One stacked band per segment, over a month-label category axis. */
export function buildComposition(comp: KpkComposition, palette: readonly string[]): CompositionModel {
	const colors = compositionColors(
		comp.segments.map((segment) => segment.name),
		palette
	)

	const source: MultiSeriesChartDataset['source'] = comp.months.map((month, monthIndex) => [
		month,
		...comp.segments.map((segment) => {
			const value = segment.series[monthIndex]
			return value == null ? null : value * MILLION
		})
	])

	return {
		title: comp.title,
		totalUsd: comp.total * MILLION,
		dataset: {
			dimensions: [MONTH_DIMENSION, ...comp.segments.map((segment) => segment.name)],
			source
		},
		charts: comp.segments.map((segment) => ({
			type: 'line',
			name: segment.name,
			stack: 'total',
			encode: { x: MONTH_DIMENSION, y: segment.name },
			color: colors[segment.name]
		})),
		rows: comp.segments.map((segment) => ({
			name: segment.name,
			valueUsd: segment.value * MILLION,
			share: segment.share,
			color: colors[segment.name]
		}))
	}
}

/** Footer totals for the vault table, over whatever subset is on screen. */
export function vaultTotals(rows: readonly KpkVault[]) {
	let tva = 0
	let interest = 0
	for (const row of rows) {
		tva += row.tva
		interest += row.interest
	}
	return { tvaUsd: tva * MILLION, interestUsd: interest * MILLION }
}
