import type * as echarts from 'echarts/core'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
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
import {
	type CustomDataConfig,
	getCustomDataRowCount,
	isCustomDataEncodedRows,
	type SqlSnapshotValue
} from '../../types'
import { ProMeta } from '../../ui'
import { generateItemId } from '../../utils/dashboardUtils'
import { scaledPx, useCardHeightScale } from '../cardHeightContext'
import { useDashboardCardContext } from '../DashboardCardContext'
import { ProCardHeader } from '../ProCardHeader'
import { ProCardEmpty, ProCardError, ProCardLoading } from '../ProCardStatus'
import { decodeRows } from './rowsEncoding'

interface CustomDataCardProps {
	config: CustomDataConfig
}

type DecodedRowsState =
	| { status: 'idle' }
	| { status: 'ready'; rows: Array<Array<SqlSnapshotValue>> }
	| { status: 'error'; message: string }

function useDecodedRows(rows: CustomDataConfig['rows']): DecodedRowsState {
	const [state, setState] = useState<DecodedRowsState>(() =>
		rows !== undefined && !isCustomDataEncodedRows(rows) ? { status: 'ready', rows } : { status: 'idle' }
	)
	useEffect(() => {
		if (rows === undefined) return
		if (!isCustomDataEncodedRows(rows)) {
			// oxlint-disable-next-line react/set-state-in-effect
			setState({ status: 'ready', rows })
			return
		}
		let cancelled = false
		decodeRows(rows).then(
			(decoded) => {
				if (!cancelled) setState({ status: 'ready', rows: decoded })
			},
			(error: unknown) => {
				if (!cancelled) {
					setState({ status: 'error', message: error instanceof Error ? error.message : 'Could not read stored rows' })
				}
			}
		)
		return () => {
			cancelled = true
		}
	}, [rows])
	return state
}

export function CustomDataCard({ config }: CustomDataCardProps) {
	const { isReadOnly } = useProDashboardPermissions()
	const { handleAppendItems } = useProDashboardEditorActions()
	const onEditCard = useDashboardCardContext()?.onEdit
	const streamDone = useContext(StreamDoneContext)
	const cardHeightScale = useCardHeightScale()
	const decoded = useDecodedRows(config.rows)
	const chartInstanceRef = useRef<echarts.ECharts | null>(null)
	const getChartInstance = useCallback(() => chartInstanceRef.current, [])

	const result = useMemo<QueryResult | null>(
		() =>
			decoded.status === 'ready'
				? normalizeSqlResultRows({ columns: config.columns, rows: decoded.rows.map((row) => [...row]) })
				: null,
		[decoded, config.columns]
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
					config.rows === undefined && !streamDone ? (
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
