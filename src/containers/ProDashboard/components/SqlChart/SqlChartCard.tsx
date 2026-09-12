import type * as echarts from 'echarts/core'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChartRouter } from '~/containers/Downloads/sql/chart'
import { migrateChartConfig } from '~/containers/Downloads/sql/chartConfig'
import { classifyColumns } from '~/containers/Downloads/sql/columnKind'
import { exportQueryResult } from '~/containers/Downloads/sql/exportResults'
import { ResultsGrid } from '~/containers/Downloads/sql/ResultsGrid'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber } from '~/utils/numberFormat'
import { snapshotToResult } from '../../sqlSnapshot'
import type { SqlChartConfig } from '../../types'
import { ProCardOverflowMenu } from '../ProCardActions'
import { SqlFreshness } from './SqlFreshness'
import { SqlQueryView } from './SqlQueryView'
import { reportSqlRefreshEnd, reportSqlRefreshStart, subscribeSqlRefreshAll } from './sqlRefreshBus'
import { useServerSqlRun } from './useServerSqlRun'

const REFRESH_HINT = 'Refresh re-runs the query on the server and updates the result for everyone.'

interface SqlChartCardProps {
	config: SqlChartConfig
}

export function SqlChartCard({ config }: SqlChartCardProps) {
	const { snapshot, isRefreshing, error, canRefresh, refresh } = useServerSqlRun(config.id, config.snapshot ?? null)
	const [cardView, setCardView] = useState<'output' | 'query'>('output')

	// Latest refresh and error for the refresh-all subscription and the unmount report, which run outside render.
	const refreshRef = useRef(refresh)
	const errorRef = useRef(error)
	useLayoutEffect(() => {
		refreshRef.current = refresh
		errorRef.current = error
	})
	useEffect(() => {
		if (!canRefresh) return
		return subscribeSqlRefreshAll(() => refreshRef.current())
	}, [canRefresh])

	useEffect(() => {
		if (!isRefreshing) return
		reportSqlRefreshStart(config.id)
		return () => reportSqlRefreshEnd(config.id, !errorRef.current)
	}, [isRefreshing, config.id])

	const chartInstanceRef = useRef<echarts.ECharts | null>(null)
	const getChartInstance = useCallback(() => chartInstanceRef.current, [])

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
				<div className="mr-auto min-w-0">
					<h2 className="truncate text-base font-semibold">{config.name || 'SQL chart'}</h2>
				</div>
				<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
					<SegmentedControl<'output' | 'query'>
						value={cardView}
						onValueChange={setCardView}
						options={[
							{ value: 'output', label: displayMode === 'table' ? 'Table' : 'Chart' },
							{ value: 'query', label: 'SQL' }
						]}
						label="SQL card view"
						variant="default"
						size="sm"
					/>
					{snapshot ? <SqlFreshness computedAt={snapshot.computedAt} /> : null}
					{canRefresh ? (
						<>
							<button
								type="button"
								onClick={refresh}
								disabled={isRefreshing}
								className="flex items-center gap-1 text-xs text-link hover:underline disabled:opacity-50"
								title="Re-run the query"
							>
								{isRefreshing ? <LoadingSpinner size={12} /> : null}
								{isRefreshing ? 'Refreshing…' : 'Refresh'}
							</button>
							<Tooltip content={REFRESH_HINT} className="flex items-center">
								<Icon name="help-circle" height={13} width={13} className="text-pro-text-tertiary" />
							</Tooltip>
						</>
					) : null}
					{cardView === 'output' ? (
						<ProCardOverflowMenu
							image={
								canExportPng
									? {
											chartInstance: getChartInstance,
											filename: config.name || 'sql-chart',
											title: config.name || 'SQL chart'
										}
									: undefined
							}
							csv={
								canExportCsv
									? { onClick: () => exportQueryResult(result, 'csv', config.name || 'sql-chart') }
									: undefined
							}
						/>
					) : null}
				</div>
			</div>

			{error ? <span className="body-xs text-data-down">Refresh failed: {error}</span> : null}

			{cardView === 'query' ? (
				<SqlQueryView config={config} snapshot={snapshot} />
			) : !snapshot || !result ? (
				<div className="flex flex-1 items-center justify-center text-sm text-pro-text-tertiary">
					{isRefreshing ? <LoadingSpinner size={20} /> : 'No data yet.'}
				</div>
			) : displayMode === 'table' ? (
				<div className="min-h-0 flex-1">
					<ResultsGrid result={result} />
				</div>
			) : !hasNumeric ? (
				<div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-pro-text-tertiary">
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

			{cardView === 'output' && snapshot?.truncated ? (
				<span className="body-xs text-pro-text-tertiary">
					Showing first {formatNumber(snapshot.rows.length)} of {formatNumber(snapshot.rowCount)} rows.
				</span>
			) : null}
		</div>
	)
}
