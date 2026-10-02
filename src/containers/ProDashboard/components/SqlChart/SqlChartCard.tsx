import type * as echarts from 'echarts/core'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { ChartRouter } from '~/containers/Downloads/sql/chart'
import { SQL_CHART_BASE_HEIGHT } from '~/containers/Downloads/sql/chart/chartLayout'
import { migrateChartConfig } from '~/containers/Downloads/sql/chartConfig'
import { classifyColumns } from '~/containers/Downloads/sql/columnKind'
import { exportQueryResult } from '~/containers/Downloads/sql/exportResults'
import { ResultsGrid } from '~/containers/Downloads/sql/ResultsGrid'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber } from '~/utils/numberFormat'
import { snapshotToResult } from '../../sqlSnapshot'
import type { SqlChartConfig } from '../../types'
import { ProButton, ProMeta, ProSegmented } from '../../ui'
import { scaledPx, useCardHeightScale } from '../cardHeightContext'
import { ProCardHeader } from '../ProCardHeader'
import { ProCardEmpty, ProCardLoading, ProCardNotice } from '../ProCardStatus'
import { SqlFreshness } from './SqlFreshness'
import { SqlQueryView } from './SqlQueryView'
import { reportSqlRefreshEnd, reportSqlRefreshStart, subscribeSqlRefreshAll } from './sqlRefreshBus'
import { useServerSqlRun } from './useServerSqlRun'

const REFRESH_HINT = 'Refresh re-runs the query on the server and updates the result for everyone.'

interface SqlChartCardProps {
	config: SqlChartConfig
}

type SqlCardBody = 'loading' | 'not-run' | 'owner-not-run' | 'table' | 'no-numeric' | 'chart'

export function sqlCardBody({
	hasResult,
	isRefreshing,
	canRefresh,
	displayMode,
	hasNumeric
}: {
	hasResult: boolean
	isRefreshing: boolean
	canRefresh: boolean
	displayMode: 'chart' | 'table'
	hasNumeric: boolean
}): SqlCardBody {
	if (!hasResult) return isRefreshing ? 'loading' : canRefresh ? 'not-run' : 'owner-not-run'
	if (displayMode === 'table') return 'table'
	return hasNumeric ? 'chart' : 'no-numeric'
}

export function SqlChartCard({ config }: SqlChartCardProps) {
	const { snapshot, isRefreshing, error, canRefresh, refresh } = useServerSqlRun(config.id, config.snapshot ?? null)
	const [cardView, setCardView] = useState<'output' | 'query'>('output')
	const cardHeightScale = useCardHeightScale()

	// Read when a refresh-all arrives and when a refresh ends, so neither effect resubscribes on every render.
	const onRefreshAll = useEffectEvent(() => refresh())
	const refreshSucceeded = useEffectEvent(() => !error)
	useEffect(() => {
		if (!canRefresh) return
		return subscribeSqlRefreshAll(() => onRefreshAll())
	}, [canRefresh])

	useEffect(() => {
		if (!isRefreshing) return
		reportSqlRefreshStart(config.id)
		return () => reportSqlRefreshEnd(config.id, refreshSucceeded())
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
	const body = sqlCardBody({ hasResult: !!result, isRefreshing, canRefresh, displayMode, hasNumeric })

	return (
		<div className="flex h-full flex-col p-0">
			<ProCardHeader
				title={config.name || 'SQL chart'}
				subtitle={
					<ProMeta
						items={[
							displayMode === 'table' ? 'Table' : 'Chart',
							snapshot ? <SqlFreshness key="freshness" computedAt={snapshot.computedAt} /> : null
						]}
					/>
				}
				viewerControls={
					<ProSegmented<'output' | 'query'>
						value={cardView}
						onValueChange={setCardView}
						options={[
							{ value: 'output', label: displayMode === 'table' ? 'Table' : 'Chart' },
							{ value: 'query', label: 'SQL' }
						]}
						label="SQL card view"
						size="sm"
					/>
				}
				controls={
					canRefresh ? (
						<>
							<ProButton
								size="sm"
								variant="ghost"
								onClick={refresh}
								disabled={isRefreshing}
								title="Re-run the query"
								{...(isRefreshing ? { loading: true } : {})}
							>
								{isRefreshing ? 'Refreshing…' : 'Refresh'}
							</ProButton>
							<Tooltip content={REFRESH_HINT} className="flex items-center">
								<Icon name="help-circle" height={13} width={13} className="text-pro-text-tertiary" />
							</Tooltip>
						</>
					) : null
				}
				menu={{
					image:
						cardView === 'output' && canExportPng
							? {
									chartInstance: getChartInstance,
									filename: config.name || 'sql-chart',
									title: config.name || 'SQL chart'
								}
							: undefined,
					csv:
						cardView === 'output' && canExportCsv
							? { onClick: () => exportQueryResult(result, 'csv', config.name || 'sql-chart') }
							: undefined
				}}
			/>
			<div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pb-3">
				{error ? (
					<ProCardNotice
						tone="error"
						title={error}
						{...(canRefresh ? { retry: { run: refresh, pending: isRefreshing } } : {})}
					>
						Couldn&apos;t refresh this query.
					</ProCardNotice>
				) : null}

				{cardView === 'query' ? (
					<SqlQueryView config={config} snapshot={snapshot} />
				) : body === 'loading' ? (
					<ProCardLoading label="Running the query…" />
				) : body === 'not-run' ? (
					<ProCardEmpty message="This query hasn't run yet." action={{ label: 'Run query', onClick: refresh }} />
				) : body === 'owner-not-run' || !result ? (
					<ProCardEmpty message="The owner hasn't run this query yet." />
				) : body === 'table' ? (
					<div className="min-h-0 flex-1">
						<ResultsGrid result={result} />
					</div>
				) : body === 'no-numeric' ? (
					<ProCardEmpty message="No numeric columns in this result to chart." />
				) : (
					<ChartRouter
						config={resolvedConfig}
						result={result}
						classified={classified}
						height={scaledPx(SQL_CHART_BASE_HEIGHT, cardHeightScale)}
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
		</div>
	)
}
