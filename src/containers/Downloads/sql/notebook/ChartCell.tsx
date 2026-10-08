import { Icon } from '~/ui/Icon'
import { formatNumber } from '~/utils/numberFormat'
import type { ChartConfig } from '../chartConfig'
import { ResultsChart } from '../ResultsChart'
import type { NotebookCell } from '../useSqlTabs'

export interface ChartSourceOption {
	name: string
	cellId: string
	hasRun: boolean
	result: NotebookCell['result']
}

interface ChartCellProps {
	cell: NotebookCell
	availableSources: Array<ChartSourceOption>
	onSourceChange: (sourceName: string) => void
	onChartConfigChange: (next: ChartConfig | null) => void
}

function describeShape(opt: ChartSourceOption): string {
	if (!opt.hasRun || !opt.result) return 'not run'
	const rows = opt.result.rows.length
	const cols = opt.result.columns.length
	return `${formatNumber(rows)}×${cols}`
}

export function ChartCell({ cell, availableSources, onSourceChange, onChartConfigChange }: ChartCellProps) {
	const selected = availableSources.find((s) => s.name === cell.source) ?? null
	const result = selected?.result ?? null
	const selectedCols = selected?.result?.columns ?? []

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-subtle bg-surface/60 px-2.5 py-1.5 body-sm">
				<span className="text-pro-text-tertiary">Source</span>
				{availableSources.length === 0 ? (
					<span className="text-pro-text-tertiary italic">
						Add a SQL cell and run it first — chart cells visualize prior cell output.
					</span>
				) : (
					<select
						value={cell.source}
						onChange={(e) => onSourceChange(e.target.value)}
						className="rounded-sm border border-subtle bg-pro-app-bg px-1.5 py-0.5 mono-sm text-pro-text-primary outline-hidden focus:border-brand"
					>
						<option value="">— pick cell —</option>
						{availableSources.map((s) => (
							<option key={s.cellId} value={s.name}>
								{s.name} · {describeShape(s)}
							</option>
						))}
					</select>
				)}
				{selected && !selected.hasRun ? (
					<span className="inline-flex items-center gap-1 text-pro-premium-300">
						<Icon name="alert-triangle" className="size-3" />
						source not yet run
					</span>
				) : selected?.result ? (
					<span className="inline-flex min-w-0 items-center gap-1.5 text-pro-text-tertiary">
						<span className="text-pro-text-secondary tabular-nums">{formatNumber(selected.result.rows.length)}</span>
						rows
						<span aria-hidden>·</span>
						<span className="flex min-w-0 flex-wrap items-center gap-1">
							{selectedCols.slice(0, 4).map((c) => (
								<span key={c.name} className="truncate mono-sm text-pro-text-secondary">
									{c.name}
								</span>
							))}
							{selectedCols.length > 4 ? (
								<span className="body-xs text-pro-text-tertiary">+{selectedCols.length - 4}</span>
							) : null}
						</span>
					</span>
				) : null}
			</div>

			{result ? (
				<ResultsChart result={result} chartConfig={cell.chartConfig} onChartConfigChange={onChartConfigChange} />
			) : (
				<div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-subtle bg-surface/40 px-6 py-10 text-center">
					<Icon name="bar-chart-2" className="size-5 text-pro-text-tertiary" />
					<p className="body-md text-pro-text-secondary">
						{cell.source
							? `${cell.source} has no results yet — run it first.`
							: 'Pick a source cell above to visualize its output.'}
					</p>
				</div>
			)}
		</div>
	)
}
