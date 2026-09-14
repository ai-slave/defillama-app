import { lazy, useMemo, useState } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { formatPercent } from '~/utils/numberFormat'
import type { KpkRangeKey } from './api'
import { KPK_COMPOSITION_CHART_OPTIONS, kpkCompositionChartOptions, kpkLineStroke, kpkPalette } from './chartDefaults'
import { asRanged, buildComposition, defaultRange, gapNote, rangeOptions, type CompositionPayload } from './transform'
import {
	Card,
	ChartFootnote,
	DashSwatch,
	DataTable,
	DuplicateMark,
	SectionHeader,
	ToggleGroup,
	usdCompact,
	type FooterRow,
	KPK_PERCENT_OPTIONS
} from './ui'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

/** A reading the stack implies but has no band of its own for, e.g. a book's total. */
export interface CompositionSubtotal {
	name: string
	/** Absolute USD. */
	valueUsd: number
	title?: string
}

export function CompositionSection({
	title,
	subtitle,
	comps,
	initialKey,
	subtotals
}: {
	title: string
	subtitle?: string
	comps: Record<string, CompositionPayload | undefined> | undefined
	/** Breakdown shown on first paint. Falls back to the first the payload sent. */
	initialKey: string
	/** Extra readings for the share table, per breakdown. */
	subtotals?: (breakdown: string) => Array<CompositionSubtotal> | undefined
}) {
	const [picked, setPicked] = useState<string | null>(null)
	const [pickedRange, setPickedRange] = useState<KpkRangeKey | null>(null)
	// The palette has its own steps per theme, so the series repaint on a light/dark toggle.
	const [isDark] = useDarkModeManager()

	const options = useMemo(
		() => Object.entries(comps ?? {}).flatMap(([key, comp]) => (comp ? [{ key, label: comp.title }] : [])),
		[comps]
	)

	// A pick survives only while the payload still carries it; otherwise fall back.
	const breakdown =
		(picked && comps?.[picked] ? picked : undefined) ??
		(comps?.[initialKey] ? initialKey : options[0]?.key) ??
		initialKey
	// Memoised because the pre-range fallback mints an object, and `ranges` keys off it.
	const ranged = useMemo(() => asRanged(comps?.[breakdown]), [comps, breakdown])

	const ranges = useMemo(() => rangeOptions(ranged), [ranged])
	const range = (pickedRange && ranged?.ranges[pickedRange] ? pickedRange : undefined) ?? defaultRange(ranged)
	const comp = range ? ranged?.ranges[range] : undefined
	const colorNames = useMemo(
		() =>
			Object.values(ranged?.ranges ?? {}).flatMap(
				(rangeComp) => rangeComp?.segments.map((segment) => segment.name) ?? []
			),
		[ranged]
	)

	const model = useMemo(
		() => (comp ? buildComposition(comp, kpkPalette(isDark), kpkLineStroke(isDark), colorNames) : null),
		[comp, isDark, colorNames]
	)

	// Rebuilt only when the overlay changes, since the formatter closes over its name.
	const overlay = model?.line
	const chartOptions = useMemo(
		() => (overlay ? kpkCompositionChartOptions(overlay.name) : KPK_COMPOSITION_CHART_OPTIONS),
		[overlay]
	)

	const note = useMemo(() => gapNote(comp), [comp])
	const extras = useMemo(() => subtotals?.(breakdown) ?? [], [subtotals, breakdown])

	const footer = useMemo<Array<FooterRow> | undefined>(() => {
		if (!model) return undefined
		const rows: Array<FooterRow> = []
		for (const extra of extras) {
			rows.push({
				muted: true,
				title: extra.title,
				cells: {
					name: extra.name,
					valueUsd: usdCompact(extra.valueUsd),
					share: model.totalUsd
						? (formatPercent((extra.valueUsd / model.totalUsd) * 100, KPK_PERCENT_OPTIONS) ?? '—')
						: '—'
				}
			})
		}
		rows.push({
			cells: {
				name: 'Total',
				valueUsd: usdCompact(model.totalUsd),
				share: formatPercent(100, KPK_PERCENT_OPTIONS) ?? '—'
			}
		})
		if (model.line) {
			rows.push({
				muted: true,
				title: model.line.note,
				cells: {
					name: (
						<span className="flex items-center gap-2">
							<DashSwatch />
							{model.line.name}
						</span>
					),
					valueUsd: usdCompact(model.line.valueUsd)
				}
			})
		}
		return rows
	}, [model, extras])

	return (
		<section className="flex flex-col gap-3">
			<SectionHeader title={title}>
				{/* Omitted rather than rendered empty while the payload is still in flight. */}
				{options.length > 0 && (
					<ToggleGroup label={`${title} breakdown`} options={options} value={breakdown} onChange={setPicked} />
				)}
				{/* A single span is not a choice, so it gets no control. */}
				{ranges.length > 1 && range && (
					<ToggleGroup<KpkRangeKey> label={`${title} range`} options={ranges} value={range} onChange={setPickedRange} />
				)}
			</SectionHeader>
			{subtitle && <p className="-mt-1 text-xs text-pro-text-secondary">{subtitle}</p>}
			{/* `minmax(0,…)` on both tracks: the default `auto` minimum is min-content, which lets
			    the share table push the chart column off the page instead of scrolling itself.
			    Splits at the mockup's own 900px-ish breakpoint rather than waiting for xl. */}
			<div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
				<Card>
					{model ? (
						<>
							<MultiSeriesChart
								dataset={model.dataset}
								charts={model.charts}
								chartOptions={chartOptions}
								valueSymbol="$"
								title=""
								height="320px"
								solidChartAreaStyle
								hideDataZoom
							/>
							{/* A hole the line joins across, named under the chart rather than left to
							    read as a measurement. */}
							{note && <p className="mt-2 body-sm text-pro-text-tertiary">{note}</p>}
							{model.line && <ChartFootnote title={model.line.name}>{model.line.note}</ChartFootnote>}
						</>
					) : (
						<div className="flex h-[320px] items-center justify-center">
							<div className="size-5 animate-spin rounded-full border-2 border-tertiary border-t-transparent" />
						</div>
					)}
				</Card>
				<Card>
					{/* The payload's own title, the same string the chip above carries. A hard space
					    while it is in flight — a collapsed empty heading would jump the table below. */}
					<h3 className="mb-2 label-sm tracking-wider text-pro-text-label uppercase">{model?.title ?? ' '}</h3>
					<DataTable
						getOccurrenceKey={(row) => row.name}
						rows={model?.rows}
						cols={[
							{
								key: 'name',
								label: 'Segment',
								render: (row) => (
									<span className="flex items-center gap-2 text-pro-text-primary">
										<span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: row.color }} />
										{row.name}
										{row.duplicate && (
											<DuplicateMark
												note={row.note ?? model?.line?.note ?? 'Counted inside another band of this breakdown.'}
											/>
										)}
									</span>
								)
							},
							{
								key: 'valueUsd',
								label: 'Value',
								right: true,
								render: (row) => usdCompact(row.valueUsd)
							},
							{
								key: 'share',
								label: 'Share',
								right: true,
								render: (row) => formatPercent(row.share, KPK_PERCENT_OPTIONS) ?? '—'
							}
						]}
						footer={footer}
					/>
				</Card>
			</div>
		</section>
	)
}
