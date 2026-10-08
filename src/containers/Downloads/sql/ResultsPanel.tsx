import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tabs, TabPanel } from '~/ui/Tabs'
import { formatNumber } from '~/utils/numberFormat'
import { FormatSplitButton } from '../FormatSplitButton'
import { defaultChartConfig, type ChartConfig } from './chartConfig'
import { classifyColumns } from './columnKind'
import { exportQueryResult, type QueryResult } from './exportResults'
import { formatSqlDuration } from './format'
import { ResultsChart } from './ResultsChart'
import { ResultsGrid } from './ResultsGrid'

type ResultsView = 'table' | 'chart'

interface ResultsPanelProps {
	result: QueryResult | null
	running: boolean
	busyLabel?: string | null
	chartConfig: ChartConfig | undefined
	onChartConfigChange: (next: ChartConfig | null) => void
	durationMs?: number | null
	/** The host keeps the view with its result (a tab, a notebook cell, a dashboard card), so it outlives a rerun. */
	view: ResultsView
	onViewChange: (next: ResultsView) => void
	viewToggleLabel?: string
}

export function ResultsPanel({
	result,
	running,
	busyLabel,
	chartConfig,
	onChartConfigChange,
	durationMs,
	view,
	onViewChange,
	viewToggleLabel
}: ResultsPanelProps) {
	const setView = (next: ResultsView) => {
		// Picking the chart view stores its default config, so a share link made from it opens on the chart.
		if (next === 'chart' && !chartConfig && result) onChartConfigChange(defaultChartConfig(classifyColumns(result)))
		onViewChange(next)
	}

	const busy = running || !!busyLabel
	const busyMessage = busyLabel ?? (running ? 'Running query…' : null)

	if (!result && !busy) {
		return (
			<div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-subtle bg-surface px-6 py-10 text-center">
				<Icon name="bar-chart-2" className="size-5 text-pro-text-tertiary" />
				<p className="body-md text-pro-text-secondary">
					Run a query to see results here. Press{' '}
					<kbd className="inline-flex h-[17px] items-center rounded-[3px] border border-subtle bg-pro-app-bg px-1 mono-sm text-pro-text-secondary">
						⌘
					</kbd>{' '}
					<kbd className="inline-flex h-[17px] items-center rounded-[3px] border border-subtle bg-pro-app-bg px-1 mono-sm text-pro-text-secondary">
						↵
					</kbd>{' '}
					or click <span className="font-medium text-pro-text-primary">Run query</span>.
				</p>
			</div>
		)
	}

	if (!result && busy) {
		return (
			<div className="flex h-24 items-center justify-center gap-2.5 rounded-md border border-subtle bg-surface px-4 body-md text-pro-text-secondary">
				<LoadingSpinner size={14} />
				<span>{busyMessage}</span>
			</div>
		)
	}

	if (!result) return null

	const isEmpty = result.rows.length === 0

	return (
		<Tabs<ResultsView> value={view} onValueChange={setView} values={['table', 'chart']}>
			<div className="flex flex-col gap-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-baseline gap-2">
						<h3 className="title-md tracking-tight text-pro-text-primary">Results</h3>
						<span className="body-sm text-pro-text-tertiary tabular-nums">
							{formatNumber(result.rows.length)} row{result.rows.length === 1 ? '' : 's'} · {result.columns.length} col
							{result.columns.length === 1 ? '' : 's'}
							{durationMs != null ? ` · ${formatSqlDuration(durationMs)}` : ''}
						</span>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{viewToggleLabel ? <span className="label-sm text-secondary">{viewToggleLabel}</span> : null}
						<SegmentedControl
							semantics="tabs"
							label="Results view"
							variant="default"
							size="sm"
							options={[
								{ value: 'table', label: <ViewLabel icon="layout-grid" label="Table" />, disabled: isEmpty },
								{ value: 'chart', label: <ViewLabel icon="bar-chart-2" label="Chart" />, disabled: isEmpty }
							]}
						/>
						<FormatSplitButton
							disabled={isEmpty}
							label="Export"
							onDownload={(format) => exportQueryResult(result, format)}
						/>
					</div>
				</div>
				<TabPanel value={view}>
					{view === 'chart' ? (
						<ResultsChart result={result} chartConfig={chartConfig} onChartConfigChange={onChartConfigChange} />
					) : (
						<ResultsGrid result={result} />
					)}
				</TabPanel>
			</div>
		</Tabs>
	)
}

function ViewLabel({ icon, label }: { icon: 'layout-grid' | 'bar-chart-2'; label: string }) {
	return (
		<>
			<Icon name={icon} className="size-3.5" />
			{label}
		</>
	)
}
