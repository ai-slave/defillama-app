import { useState } from 'react'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { formatNumber } from '~/utils/numberFormat'
import { FormatSplitButton } from '../FormatSplitButton'
import type { ChartConfig } from './chartConfig'
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
	preferredView?: ResultsView
	onConsumePreferredView?: () => void
	durationMs?: number | null
	view?: ResultsView
	onViewChange?: (next: ResultsView) => void
	viewToggleLabel?: string
}

export function ResultsPanel({
	result,
	running,
	busyLabel,
	chartConfig,
	onChartConfigChange,
	preferredView,
	onConsumePreferredView,
	durationMs,
	view: controlledView,
	onViewChange,
	viewToggleLabel
}: ResultsPanelProps) {
	const [internalView, setInternalView] = useState<ResultsView>(preferredView ?? 'table')
	const isControlled = controlledView !== undefined
	const view = isControlled ? controlledView : internalView
	const setView = isControlled ? (onViewChange ?? (() => {})) : setInternalView

	const resultId = result ? `${result.columns.map((c) => c.name).join('|')}:${result.rows.length}` : ''
	const [prevResultId, setPrevResultId] = useState(resultId)
	if (prevResultId !== resultId) {
		setPrevResultId(resultId)
		if (!isControlled) {
			if (preferredView) {
				setInternalView(preferredView)
				onConsumePreferredView?.()
			} else {
				setInternalView('table')
			}
		}
	}

	const busy = running || !!busyLabel
	const busyMessage = busyLabel ?? (running ? 'Running query…' : null)

	if (!result && !busy) {
		return (
			<div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-subtle bg-surface/40 px-6 py-10 text-center">
				<Icon name="bar-chart-2" className="size-5 text-pro-text-tertiary" />
				<p className="text-sm text-pro-text-secondary">
					Run a query to see results here. Press{' '}
					<kbd className="inline-flex h-[17px] items-center rounded-[3px] border border-subtle bg-pro-app-bg px-1 font-mono text-[10px] text-pro-text-secondary">
						⌘
					</kbd>{' '}
					<kbd className="inline-flex h-[17px] items-center rounded-[3px] border border-subtle bg-pro-app-bg px-1 font-mono text-[10px] text-pro-text-secondary">
						↵
					</kbd>{' '}
					or click <span className="font-medium text-pro-text-primary">Run query</span>.
				</p>
			</div>
		)
	}

	if (!result && busy) {
		return (
			<div className="flex h-24 items-center justify-center gap-2.5 rounded-md border border-subtle bg-surface px-4 text-sm text-pro-text-secondary">
				<LoadingSpinner size={14} />
				<span>{busyMessage}</span>
			</div>
		)
	}

	if (!result) return null

	const isEmpty = result.rows.length === 0

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-baseline gap-2">
					<h3 className="text-sm font-semibold tracking-tight text-pro-text-primary">Results</h3>
					<span className="text-xs text-pro-text-tertiary tabular-nums">
						{formatNumber(result.rows.length)} row{result.rows.length === 1 ? '' : 's'} · {result.columns.length} col
						{result.columns.length === 1 ? '' : 's'}
						{durationMs != null ? ` · ${formatSqlDuration(durationMs)}` : ''}
					</span>
				</div>
				<div className="flex items-center gap-2">
					{viewToggleLabel ? <span className="text-xs font-medium text-secondary">{viewToggleLabel}</span> : null}
					<ViewToggle view={view} onChange={setView} disabled={isEmpty} />
					<FormatSplitButton
						disabled={isEmpty}
						label="Export"
						onDownload={(format) => exportQueryResult(result, format)}
					/>
				</div>
			</div>
			{view === 'chart' ? (
				<ResultsChart result={result} chartConfig={chartConfig} onChartConfigChange={onChartConfigChange} />
			) : (
				<ResultsGrid result={result} />
			)}
		</div>
	)
}

function ViewToggle({
	view,
	onChange,
	disabled
}: {
	view: ResultsView
	onChange: (next: ResultsView) => void
	disabled?: boolean
}) {
	return (
		<div
			role="tablist"
			aria-label="Results view"
			className={`inline-flex items-center gap-0.5 rounded-md border border-subtle bg-surface p-0.5 ${
				disabled ? 'pointer-events-none opacity-50' : ''
			}`}
		>
			<ToggleButton active={view === 'table'} onClick={() => onChange('table')} label="Table" icon="layout-grid" />
			<ToggleButton active={view === 'chart'} onClick={() => onChange('chart')} label="Chart" icon="bar-chart-2" />
		</div>
	)
}

function ToggleButton({
	active,
	onClick,
	label,
	icon
}: {
	active: boolean
	onClick: () => void
	label: string
	icon: 'layout-grid' | 'bar-chart-2'
}) {
	return (
		<button
			role="tab"
			type="button"
			aria-selected={active}
			onClick={onClick}
			className={`flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-medium transition-colors ${
				active
					? 'bg-brand text-on-brand shadow-sm'
					: 'text-pro-text-secondary hover:bg-hover-row hover:text-pro-text-primary'
			}`}
		>
			<Icon name={icon} className="size-3" />
			{label}
		</button>
	)
}
