import type * as echarts from 'echarts/core'
import { useCallback, useContext, useMemo, useRef } from 'react'
import { ChartRouter } from '~/containers/Downloads/sql/chart'
import { SQL_CHART_BASE_HEIGHT } from '~/containers/Downloads/sql/chart/chartLayout'
import { migrateChartConfig } from '~/containers/Downloads/sql/chartConfig'
import { classifyColumns } from '~/containers/Downloads/sql/columnKind'
import { exportQueryResult, type QueryResult } from '~/containers/Downloads/sql/exportResults'
import { normalizeSqlResultRows } from '~/containers/Downloads/sql/resultNormalization'
import { ResultsGrid } from '~/containers/Downloads/sql/ResultsGrid'
import { formatNumber } from '~/utils/numberFormat'
import { useProDashboardEditorActions, useProDashboardPermissions } from '../../ProDashboardAPIContext'
import { StreamDoneContext } from '../../queries'
import { type CustomDataConfig, getCustomDataRowCount } from '../../types'
import { ProMeta } from '../../ui'
import { generateItemId } from '../../utils/dashboardUtils'
import { scaledPx, useCardHeightScale } from '../cardHeightContext'
import { useDashboardCardContext } from '../DashboardCardContext'
import { ProCardHeader } from '../ProCardHeader'
import { ProCardEmpty, ProCardError, ProCardLoading } from '../ProCardStatus'
import { useDecodedRows } from './rowsEncoding'

interface CustomDataCardProps {
	config: CustomDataConfig
}

export function CustomDataCard({ config }: CustomDataCardProps) {
	const { isReadOnly } = useProDashboardPermissions()
	const { handleAppendItems } = useProDashboardEditorActions()
	const onEditCard = useDashboardCardContext()?.onEdit
	const streamDone = useContext(StreamDoneContext)
	const cardHeightScale = useCardHeightScale()
	const decoded = useDecodedRows(config.rows)
	const decodedRows = decoded.status === 'ready' ? decoded.rows : null
	const chartInstanceRef = useRef<echarts.ECharts | null>(null)
	const getChartInstance = useCallback(() => chartInstanceRef.current, [])

	const result = useMemo<QueryResult | null>(
		() =>
			decodedRows
				? normalizeSqlResultRows({ columns: config.columns, rows: decodedRows.map((row) => [...row]) })
				: null,
		[decodedRows, config.columns]
	)
	const classified = useMemo(() => (result ? classifyColumns(result) : []), [result])
	const resolvedConfig = useMemo(
		() => (result ? migrateChartConfig(config.chart, classified) : config.chart),
		[result, config.chart, classified]
	)
	const hasNumeric = classified.some((column) => column.coarse === 'number')
	const displayMode = config.displayMode
	const rowCount = result ? result.rows.length : getCustomDataRowCount(config.rows)
	const filename = config.name || 'custom-data'
	const duplicate = () =>
		handleAppendItems(
			() => [{ ...config, id: generateItemId('custom-data', ''), name: `${config.name} (Duplicate)` }],
			{
				afterItemId: config.id
			}
		)

	return (
		<div className="flex h-full flex-col p-0">
			<ProCardHeader
				title={config.name || 'Custom data'}
				subtitle={
					<ProMeta
						items={[config.sourceName ?? null, `${formatNumber(rowCount)} ${rowCount === 1 ? 'row' : 'rows'}`]}
					/>
				}
				menu={{
					image:
						displayMode === 'chart' && result && hasNumeric
							? { chartInstance: getChartInstance, filename, title: config.name || 'Custom data' }
							: undefined,
					csv: result ? { onClick: () => exportQueryResult(result, 'csv', filename) } : undefined,
					onDuplicate: isReadOnly ? undefined : duplicate
				}}
			/>
			<div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pb-3">
				{decoded.status === 'error' ? (
					<ProCardError
						role="status"
						title="Stored rows couldn't be read"
						detail="Edit the card and upload the file again."
						{...(onEditCard ? { action: { label: 'Edit card', onClick: onEditCard } } : {})}
					/>
				) : !result ? (
					// Without a result, stored rows are still decoding.
					config.rows !== undefined || !streamDone ? (
						<ProCardLoading variant="table" />
					) : (
						<ProCardEmpty message="No rows stored." />
					)
				) : displayMode === 'table' ? (
					<div className="min-h-0 flex-1">
						<ResultsGrid result={result} />
					</div>
				) : !hasNumeric ? (
					<ProCardEmpty message="No numeric columns in this dataset to chart." />
				) : (
					<ChartRouter
						config={resolvedConfig}
						result={result}
						classified={classified}
						height={scaledPx(SQL_CHART_BASE_HEIGHT, cardHeightScale)}
						onReady={(instance) => {
							chartInstanceRef.current = instance
						}}
					/>
				)}
			</div>
		</div>
	)
}
