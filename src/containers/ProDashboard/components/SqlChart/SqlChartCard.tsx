import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { Icon } from '~/components/Icon'
import { ChartRouter } from '~/containers/Downloads/sql/chart'
import { migrateChartConfig } from '~/containers/Downloads/sql/chartConfig'
import { classifyColumns } from '~/containers/Downloads/sql/columnKind'
import { exportQueryResult } from '~/containers/Downloads/sql/exportResults'
import { ResultsGrid } from '~/containers/Downloads/sql/ResultsGrid'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import type { SqlChartConfig } from '../../types'
import { ProTableCSVButton } from '../ProTable/CsvButton'
import { snapshotToResult } from './snapshot'
import { reportSqlRefreshEnd, reportSqlRefreshStart, subscribeSqlRefreshAll } from './sqlRefreshBus'
import { useServerSqlRun } from './useServerSqlRun'

const REFRESH_HINT = 'Refresh re-runs the query on the server and updates the result for everyone.'

interface SqlChartCardProps {
	config: SqlChartConfig
}

const FRESHNESS_YELLOW_MS = 24 * 60 * 60 * 1000
const FRESHNESS_RED_MS = 48 * 60 * 60 * 1000

function freshness(iso: string): { dot: string; label: string } {
	const computed = new Date(iso).getTime()
	if (!Number.isFinite(computed)) return { dot: 'bg-red-500', label: 'Unknown data age' }
	const age = Date.now() - computed
	if (age < FRESHNESS_YELLOW_MS) return { dot: 'bg-green-500', label: 'Data is fresh (updated within 24h)' }
	if (age < FRESHNESS_RED_MS) return { dot: 'bg-amber-500', label: 'Data is older than 24h' }
	return { dot: 'bg-red-500', label: 'Data is older than 48h' }
}

function timeAgo(iso: string): string {
	const then = new Date(iso).getTime()
	if (!Number.isFinite(then)) return ''
	const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
	if (secs < 60) return 'just now'
	const mins = Math.floor(secs / 60)
	if (mins < 60) return `${mins}m ago`
	const hours = Math.floor(mins / 60)
	if (hours < 24) return `${hours}h ago`
	const days = Math.floor(hours / 24)
	if (days < 30) return `${days}d ago`
	const months = Math.floor(days / 30)
	if (months < 12) return `${months}mo ago`
	return `${Math.floor(months / 12)}y ago`
}

export function SqlChartCard({ config }: SqlChartCardProps) {
	const { snapshot, isRefreshing, error, canRefresh, refresh } = useServerSqlRun(config.id, config.snapshot)

	const refreshRef = useRef(refresh)
	refreshRef.current = refresh
	useEffect(() => {
		if (!canRefresh) return
		return subscribeSqlRefreshAll(() => refreshRef.current())
	}, [canRefresh])

	const errorRef = useRef(error)
	errorRef.current = error
	useEffect(() => {
		if (!isRefreshing) return
		reportSqlRefreshStart(config.id)
		return () => reportSqlRefreshEnd(config.id, !errorRef.current)
	}, [isRefreshing, config.id])

	const chartInstanceRef = useRef<any>(null)
	const getChartInstance = useCallback(() => chartInstanceRef.current, [])

	const [copiedSql, setCopiedSql] = useState(false)
	const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	useEffect(
		() => () => {
			if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
		},
		[]
	)
	const copySql = useCallback(() => {
		if (typeof navigator === 'undefined' || !navigator.clipboard) return
		navigator.clipboard.writeText(config.query.sql).then(
			() => {
				setCopiedSql(true)
				if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
				copiedTimerRef.current = setTimeout(() => setCopiedSql(false), 1500)
			},
			() => undefined
		)
	}, [config.query.sql])

	const result = useMemo(() => (snapshot ? snapshotToResult(snapshot) : null), [snapshot])
	const classified = useMemo(() => (result ? classifyColumns(result) : []), [result])
	const resolvedConfig = useMemo(
		() => (result ? migrateChartConfig(config.chart, classified) : config.chart),
		[result, config.chart, classified]
	)
	const hasNumeric = classified.some((c) => c.coarse === 'number')
	const displayMode = config.displayMode ?? 'chart'
	const canExportPng = displayMode === 'chart' && !!result && hasNumeric
	const canExportCsv = !!result

	return (
		<div className="flex h-full flex-col gap-2 p-1 md:p-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="mr-auto flex min-w-0 items-center gap-2">
					<h2 className="truncate text-base font-semibold">{config.name || 'SQL chart'}</h2>
				</div>
				<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
					{snapshot ? (
						<span className="flex items-center gap-1.5 text-xs pro-text3" title={freshness(snapshot.computedAt).label}>
							<span
								aria-hidden
								className={`inline-block size-1.5 shrink-0 rounded-full ${freshness(snapshot.computedAt).dot}`}
							/>
							Updated {timeAgo(snapshot.computedAt)}
						</span>
					) : null}
					{canRefresh ? (
						<>
							<button
								type="button"
								onClick={refresh}
								disabled={isRefreshing}
								className="flex items-center gap-1 text-xs text-(--link-text) hover:underline disabled:opacity-50"
								title="Re-run the query"
							>
								{isRefreshing ? <LoadingSpinner size={12} /> : null}
								{isRefreshing ? 'Refreshing…' : 'Refresh'}
							</button>
							<Tooltip content={REFRESH_HINT} className="flex items-center">
								<Icon name="help-circle" height={13} width={13} className="pro-text3" />
							</Tooltip>
						</>
					) : null}
					<button
						type="button"
						onClick={copySql}
						className="flex items-center pro-text3 transition-colors hover:pro-text1"
						title={copiedSql ? 'Copied' : 'Copy SQL query'}
					>
						<Icon name={copiedSql ? 'check' : 'copy'} height={13} width={13} />
						<span className="sr-only">Copy SQL query</span>
					</button>
					{canExportPng ? (
						<ChartPngExportButton
							chartInstance={getChartInstance}
							filename={config.name || 'sql-chart'}
							title={config.name || 'SQL chart'}
							smol
						/>
					) : null}
					{canExportCsv ? (
						<ProTableCSVButton
							onClick={() => exportQueryResult(result, 'csv', config.name || 'sql-chart')}
							smol
							className="flex items-center gap-1 rounded-md border border-(--form-control-border) px-1.5 py-1 text-xs hover:border-transparent hover:not-disabled:pro-btn-blue focus-visible:border-transparent focus-visible:not-disabled:pro-btn-blue disabled:border-(--cards-border) disabled:text-(--text-disabled)"
						/>
					) : null}
				</div>
			</div>

			{error ? <span className="text-[10px] text-red-500">Refresh failed: {error}</span> : null}

			{!snapshot || !result ? (
				<div className="flex flex-1 items-center justify-center text-sm pro-text3">
					{isRefreshing ? <LoadingSpinner size={20} /> : 'No data yet.'}
				</div>
			) : displayMode === 'table' ? (
				<div className="min-h-0 flex-1">
					<ResultsGrid result={result} />
				</div>
			) : !hasNumeric ? (
				<div className="flex flex-1 items-center justify-center px-6 text-center text-sm pro-text3">
					No numeric columns in this result to chart.
				</div>
			) : (
				<ChartRouter
					config={resolvedConfig}
					result={result}
					classified={classified}
					onReady={(inst) => {
						chartInstanceRef.current = inst
					}}
				/>
			)}

			{snapshot?.truncated ? (
				<span className="text-[10px] pro-text3">
					Showing first {snapshot.rows.length.toLocaleString()} of {snapshot.rowCount.toLocaleString()} rows.
				</span>
			) : null}
		</div>
	)
}
