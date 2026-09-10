import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { formatDate } from '~/utils/dateFormat'
import { KPK_RANGES, type KpkComposition, type KpkRangedComposition, type KpkRangeKey, type KpkVault } from './api'

/** Upstream monetary fields are in $m; charts and the USD formatters want absolute dollars. */
export const MILLION = 1e6

/**
 * The x-axis dimension of every composition dataset: the payload's own period
 * labels, plotted as categories. Monthly on Overview and Mandates, daily on
 * Vaults — hence the neutral name, which is also the CSV export's header.
 */
export const PERIOD_DIMENSION = 'Period'

/**
 * Colour by segment name, not by position.
 *
 * `comp.segments` arrives sorted by current value, so indexing the palette by
 * position would repaint every band the moment two segments swap places. Sorting
 * the names first makes a segment's colour a function of the breakdown's
 * membership only.
 */
export function compositionColors(
	names: ReadonlyArray<string>,
	palette: ReadonlyArray<string>
): Record<string, string> {
	const colors: Record<string, string> = {}
	const sorted = [...new Set(names)].sort()
	for (let i = 0; i < sorted.length; i++) {
		colors[sorted[i]] = palette[i % palette.length]
	}
	return colors
}

export const RANGE_LABELS: Record<KpkRangeKey, string> = {
	'1m': '1M',
	'3m': '3M',
	ytd: 'YTD',
	max: 'Max'
}

export type CompositionPayload = KpkRangedComposition | KpkComposition

export function asRanged(comp: CompositionPayload | undefined): KpkRangedComposition | undefined {
	if (!comp) return undefined
	if ('ranges' in comp) return comp
	return { title: comp.title, ranges: { max: comp } }
}

export function rangeOptions(ranged: KpkRangedComposition | undefined): Array<{ key: KpkRangeKey; label: string }> {
	return KPK_RANGES.filter((key) => ranged?.ranges[key]).map((key) => ({ key, label: RANGE_LABELS[key] }))
}

export function defaultRange(ranged: KpkRangedComposition | undefined): KpkRangeKey | undefined {
	const available = KPK_RANGES.filter((key) => ranged?.ranges[key])
	return available[available.length - 1]
}

export function gapNote(comp: KpkComposition | undefined): string {
	const gaps = comp?.window?.gaps
	if (!gaps?.length) return ''
	return `${gaps
		.map(
			(gap) =>
				`${gap.days} days missing between ${formatDate(gap.from) ?? gap.from} and ${
					formatDate(gap.to) ?? gap.to
				} — the line joins straight across it`
		)
		.join('. ')}.`
}

export interface CompositionRow {
	name: string
	/** Absolute USD. */
	valueUsd: number
	share: number
	color: string
	/** Also counted inside another row of the same breakdown; `line` nets it out. */
	duplicate?: boolean
	/** Why this row is a duplicate, where the payload states it per band. */
	note?: string
}

export interface CompositionLineModel {
	name: string
	note: string
	valueUsd: number
}

export interface CompositionModel {
	title: string
	/** Absolute USD. */
	totalUsd: number
	dataset: MultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	/** Legend/breakdown table rows, largest first — same order as the payload. */
	rows: Array<CompositionRow>
	line?: CompositionLineModel
}

export function buildComposition(
	comp: KpkComposition,
	palette: ReadonlyArray<string>,
	lineColor: string,
	colorNames: ReadonlyArray<string> = comp.segments.map((segment) => segment.name)
): CompositionModel {
	const colors = compositionColors(colorNames, palette)
	const line = comp.line
	const lineFits = !!line && line.series.length === comp.months.length

	const cell = (value: number | null | undefined) => (value == null ? null : value * MILLION)

	const source: MultiSeriesChartDataset['source'] = comp.months.map((month, monthIndex) => [
		month,
		...comp.segments.map((segment) => cell(segment.series[monthIndex])),
		...(lineFits ? [cell(line!.series[monthIndex])] : [])
	])

	return {
		title: comp.title,
		totalUsd: comp.total * MILLION,
		dataset: {
			dimensions: [
				PERIOD_DIMENSION,
				...comp.segments.map((segment) => segment.name),
				...(lineFits ? [line!.name] : [])
			],
			source
		},
		charts: [
			...comp.segments.map((segment): MultiSeriesChartSeriesConfig => ({
				type: 'line',
				name: segment.name,
				stack: 'total',
				encode: { x: PERIOD_DIMENSION, y: segment.name },
				color: colors[segment.name]
			})),
			...(lineFits
				? [
						{
							type: 'line' as const,
							name: line!.name,
							encode: { x: PERIOD_DIMENSION, y: line!.name },
							color: lineColor,
							hideAreaStyle: true,
							lineStyle: { type: 'dashed' as const, width: 1.4 },
							excludeFromTooltipTotal: true
						}
					]
				: [])
		],
		rows: comp.segments.map((segment) => ({
			name: segment.name,
			valueUsd: segment.value * MILLION,
			share: segment.share,
			color: colors[segment.name],
			...(segment.duplicate ? { duplicate: true } : {}),
			...(segment.note ? { note: segment.note } : {})
		})),
		...(line ? { line: { name: line.name, note: line.note, valueUsd: line.value * MILLION } } : {})
	}
}

export function vaultTotals(rows: ReadonlyArray<KpkVault>) {
	let tva = 0
	let interest = 0
	let tvaAdjusted = 0
	let interestAdjusted = 0
	const duplicateVenues = new Set<string>()

	for (const row of rows) {
		tva += row.tva
		interest += row.interest
		if (row.doubleCounted) {
			duplicateVenues.add(row.venue)
		} else {
			tvaAdjusted += row.tva
			interestAdjusted += row.interest
		}
	}

	return {
		tvaUsd: tva * MILLION,
		interestUsd: interest * MILLION,
		tvaAdjustedUsd: tvaAdjusted * MILLION,
		interestAdjustedUsd: interestAdjusted * MILLION,
		duplicateVenues: [...duplicateVenues]
	}
}
