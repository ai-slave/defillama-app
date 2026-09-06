import { lazy, useMemo, useState } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import type { KpkComposition } from './api'
import { KPK_COMPOSITION_CHART_OPTIONS, kpkCompositionChartOptions, kpkLineStroke, kpkPalette } from './chartDefaults'
import { buildComposition } from './transform'
import {
	Card,
	ChartFootnote,
	DashSwatch,
	DataTable,
	DuplicateMark,
	SectionHeader,
	ToggleGroup,
	pct,
	usd,
	type FooterRow
} from './ui'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

/**
 * One stacked-area breakdown with its own toggle and share table. Every tab uses
 * the same `comp` payload, so all three compositions render through this.
 */
export function CompositionSection({
	title,
	subtitle,
	comps,
	initialKey
}: {
	title: string
	subtitle?: string
	comps: Record<string, KpkComposition | undefined> | undefined
	/** Breakdown shown on first paint. Falls back to the first the payload sent. */
	initialKey: string
}) {
	const [picked, setPicked] = useState<string | null>(null)
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
	const comp = comps?.[breakdown]
	const model = useMemo(
		() => (comp ? buildComposition(comp, kpkPalette(isDark), kpkLineStroke(isDark)) : null),
		[comp, isDark]
	)

	// Rebuilt only when the overlay changes, since the formatter closes over its name.
	const chartOptions = useMemo(
		() => (model?.line ? kpkCompositionChartOptions(model.line.name) : KPK_COMPOSITION_CHART_OPTIONS),
		[model?.line]
	)

	const footer = useMemo<Array<FooterRow> | undefined>(() => {
		if (!model) return undefined
		const rows: Array<FooterRow> = [{ cells: { name: 'Total', valueUsd: usd(model.totalUsd), share: pct(100, 1) } }]
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
					valueUsd: usd(model.line.valueUsd)
				}
			})
		}
		return rows
	}, [model])

	return (
		<section className="flex flex-col gap-3">
			<SectionHeader title={title}>
				{/* Omitted rather than rendered empty while the payload is still in flight. */}
				{options.length > 0 && (
					<ToggleGroup label={`${title} breakdown`} options={options} value={breakdown} onChange={setPicked} />
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
					<h3 className="mb-2 label-sm tracking-wider text-pro-text-label uppercase">{model?.title ?? ' '}</h3>
					<DataTable
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
											<DuplicateMark note={model?.line?.note ?? 'Counted inside another band of this breakdown.'} />
										)}
									</span>
								)
							},
							{ key: 'valueUsd', label: 'Value', right: true, render: (row) => usd(row.valueUsd) },
							{ key: 'share', label: 'Share', right: true, render: (row) => pct(row.share, 1) }
						]}
						footer={footer}
					/>
				</Card>
			</div>
		</section>
	)
}
