import { lazy, useMemo, useState } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import type { KpkComposition } from './api'
import { KPK_MONTHLY_USD_CHART_OPTIONS, kpkPalette } from './chartDefaults'
import { buildComposition } from './transform'
import { Card, DataTable, SectionHeader, ToggleGroup, pct, usd } from './ui'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

/**
 * One stacked-area breakdown with its own toggle and share table. Every tab uses
 * the same `comp` payload, so all three compositions render through this.
 */
export function CompositionSection<K extends string>({
	title,
	subtitle,
	comps,
	options,
	initialKey
}: {
	title: string
	subtitle?: string
	comps: Record<string, KpkComposition> | undefined
	options: ReadonlyArray<{ key: K; label: string }>
	initialKey: K
}) {
	const [breakdown, setBreakdown] = useState<K>(initialKey)
	// The palette has its own steps per theme, so the series repaint on a light/dark toggle.
	const [isDark] = useDarkModeManager()
	const comp = comps?.[breakdown]
	const model = useMemo(() => (comp ? buildComposition(comp, kpkPalette(isDark)) : null), [comp, isDark])

	return (
		<section className="flex flex-col gap-3">
			<SectionHeader title={title}>
				<ToggleGroup<K> label={`${title} breakdown`} options={options} value={breakdown} onChange={setBreakdown} />
			</SectionHeader>
			{subtitle && <p className="-mt-1 text-xs text-pro-text-secondary">{subtitle}</p>}
			{/* `minmax(0,…)` on both tracks: the default `auto` minimum is min-content, which lets
			    the share table push the chart column off the page instead of scrolling itself.
			    Splits at the mockup's own 900px-ish breakpoint rather than waiting for xl. */}
			<div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
				<Card>
					{model ? (
						<MultiSeriesChart
							dataset={model.dataset}
							charts={model.charts}
							chartOptions={KPK_MONTHLY_USD_CHART_OPTIONS}
							valueSymbol="$"
							title=""
							height="320px"
							solidChartAreaStyle
							hideDataZoom
						/>
					) : (
						<div className="flex h-[320px] items-center justify-center">
							<div className="size-5 animate-spin rounded-full border-2 border-tertiary border-t-transparent" />
						</div>
					)}
				</Card>
				<Card>
					<h3 className="mb-2 text-[11px] font-medium tracking-wider text-pro-text-label uppercase">
						{model?.title ?? options.find((option) => option.key === breakdown)?.label}
					</h3>
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
									</span>
								)
							},
							{ key: 'valueUsd', label: 'Value', right: true, render: (row) => usd(row.valueUsd) },
							{ key: 'share', label: 'Share', right: true, render: (row) => pct(row.share, 1) }
						]}
						footer={model ? { name: 'Total', valueUsd: usd(model.totalUsd), share: pct(100, 1) } : undefined}
					/>
				</Card>
			</div>
		</section>
	)
}
