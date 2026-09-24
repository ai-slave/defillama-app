import type * as echarts from 'echarts/core'
import { lazy, Suspense, useContext, useMemo, useState } from 'react'
import { createSingleSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { Select } from '~/components/Select/Select'
import { formatUnlockDate } from '~/containers/Unlocks/dateFormat'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { downloadCSV } from '~/utils/download'
import { getChartDataPrerequisite, toChartRuntimeState } from '../chartRuntime'
import { useProDashboardCatalog, useProDashboardEditorActions, useProDashboardTime } from '../ProDashboardAPIContext'
import { ProxyAuthTokenContext, StreamDoneContext, useChartData } from '../queries'
import {
	type Chain,
	type ChartConfig,
	type DashboardGrouping,
	getDashboardChartValueSymbol,
	getProDashboardChartTypeConfig,
	isDailyAverageChartType,
	type Protocol
} from '../types'
import { ProMeta, ProSegmented } from '../ui'
import {
	DASHBOARD_CHART_GROUPING,
	generateChartColor,
	getCsvPeriodCells,
	getCsvPeriodHeaders,
	getGroupedMetricTitle,
	getItemIconUrl
} from '../utils'
import { BoundParameterBadge } from './BoundParameterBadge'
import { useCardHeightScale, scaledPx } from './cardHeightContext'
import { DASHBOARD_GROUPING_LABELS, DASHBOARD_GROUPING_SEGMENTS } from './dashboardGroupingSegments'
import { EntityIcon } from './EntityIcon'
import { ProCardHeader } from './ProCardHeader'
import { ProCardEmpty, ProCardError, ProCardLoading } from './ProCardStatus'
import { buildSingleMetricChartDataset } from './singleMetricChart'
import { useChartSyncGroup } from './useChartSyncGroup'
import { useDashboardAnnotationHallmarks } from './useDashboardAnnotationHallmarks'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

interface ChartCardProps {
	chart: ChartConfig
}

interface ChartRendererProps {
	type: ChartConfig['type']
	showCumulative: ChartConfig['showCumulative']
	grouping: DashboardGrouping
	dataset: MultiSeriesChartDataset
	isLoading: boolean
	hasError: boolean
	refetch: () => void
	color: string
	onChartReady: (instance: echarts.ECharts | null) => void
}

const CUMULATIVE_DISPLAY_OPTIONS = [
	{ name: 'Show individual values', key: 'Individual' },
	{ name: 'Show cumulative values', key: 'Cumulative' }
]

function ChartRenderer({
	type,
	showCumulative = false,
	grouping,
	dataset,
	isLoading,
	hasError,
	refetch,
	color,
	onChartReady
}: ChartRendererProps) {
	const chartType = getProDashboardChartTypeConfig(type)
	if (!chartType) throw new Error(`Unsupported dashboard chart type: ${type}`)
	const [todayTimestamp] = useState(() => Math.floor(Date.now() / 1000))
	const valueSymbol = getDashboardChartValueSymbol(type)
	const chartOptions = useMemo(
		() => createSingleSeriesChartOptions(valueSymbol, DASHBOARD_CHART_GROUPING[grouping]),
		[valueSymbol, grouping]
	)
	const seriesName = dataset.dimensions[1]
	if (!seriesName) throw new Error(`Missing series dimension for dashboard chart type: ${type}`)
	const charts = useMemo<NonNullable<IMultiSeriesChartProps['charts']>>(() => {
		return [
			{
				type: chartType.chartType === 'bar' && !showCumulative ? 'bar' : 'line',
				name: seriesName,
				encode: { x: 'timestamp', y: seriesName },
				color,
				stack: 'value'
			}
		]
	}, [chartType.chartType, color, seriesName, showCumulative])

	const todayHallmarks = useMemo<Array<[number, string]> | undefined>(
		() => (type === 'unlocks' ? [[todayTimestamp, formatUnlockDate(todayTimestamp)]] : undefined),
		[todayTimestamp, type]
	)
	const hallmarks = useDashboardAnnotationHallmarks(todayHallmarks)
	const syncGroup = useChartSyncGroup()
	const scale = useCardHeightScale()
	const chartHeight = scaledPx(type === 'unlocks' ? 360 : 300, scale)

	if (isLoading) {
		return (
			<div className="flex flex-1 flex-col" style={{ minHeight: chartHeight }}>
				<ProCardLoading />
			</div>
		)
	}

	if (hasError) {
		return (
			<ProCardError
				onRetry={() => {
					refetch()
				}}
			/>
		)
	}

	if (dataset.source.length === 0) {
		return <ProCardEmpty message="No data available" />
	}

	return (
		<Suspense fallback={<div style={{ height: chartHeight }} />}>
			<MultiSeriesChart
				dataset={dataset}
				charts={charts}
				valueSymbol={valueSymbol}
				height={chartHeight}
				hideDataZoom
				{...(hallmarks ? { hallmarks } : {})}
				hallmarkStyle="mark-line"
				{...(syncGroup ? { syncGroup } : {})}
				{...(chartOptions ? { chartOptions } : {})}
				exportButtons="hidden"
				onReady={onChartReady}
			/>
		</Suspense>
	)
}

export function ChartCard({ chart }: ChartCardProps) {
	const { getChainInfo, getProtocolInfo, parentMapping, protocolBySlug, protocolCatalog } = useProDashboardCatalog()
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { handleGroupingChange, handleCumulativeChange } = useProDashboardEditorActions()
	const { chartInstance, handleChartReady } = useChartImageExport()
	const authToken = useContext(ProxyAuthTokenContext)
	const streamDone = useContext(StreamDoneContext)
	const chartQuery = useChartData(
		chart,
		protocolCatalog,
		protocolBySlug,
		timePeriod,
		customTimePeriod,
		authToken,
		parentMapping
	)
	const chartState = toChartRuntimeState(
		chartQuery,
		streamDone,
		getChartDataPrerequisite(chart, protocolCatalog, protocolBySlug)
	)

	const { itemName, itemIconUrl, chartTypeDetails, isGroupable, isBarChart, showCumulative, chartColor } =
		useMemo(() => {
			const chartTypeDetails = getProDashboardChartTypeConfig(chart.type)
			if (!chartTypeDetails) throw new Error(`Unsupported dashboard chart type: ${chart.type}`)
			const isGroupable = 'groupable' in chartTypeDetails && chartTypeDetails.groupable
			const isBarChart = chartTypeDetails.chartType === 'bar'
			// A saved cumulative setting stays in the config but never applies to a daily-average metric.
			const showCumulative = (chart.showCumulative || false) && !isDailyAverageChartType(chart.type)

			let itemName: string
			let itemIconUrl: string | undefined
			let itemInfo: Chain | Protocol | undefined
			let itemIdentifier: string
			if (chart.subjectType === 'protocol') {
				itemInfo = getProtocolInfo(chart.protocol)
				itemName = itemInfo?.name || chart.protocol
				itemIconUrl = getItemIconUrl('protocol', itemInfo, chart.protocol)
				itemIdentifier = chart.protocol
			} else {
				itemInfo = getChainInfo(chart.chain)
				itemName = chart.chain
				itemIconUrl = getItemIconUrl('chain', itemInfo, chart.chain)
				itemIdentifier = chart.chain
			}

			const chartColor = chart.color || generateChartColor(itemIdentifier, chartTypeDetails?.color)

			return {
				itemName,
				itemIconUrl,
				itemInfo,
				itemIdentifier,
				chartColor,
				chartTypeDetails,
				isGroupable,
				isBarChart,
				showCumulative
			}
		}, [chart, getChainInfo, getProtocolInfo])

	// The grouping applied to the data. Metrics that cannot be grouped stay daily.
	const grouping: DashboardGrouping = isGroupable ? (chart.grouping ?? 'day') : 'day'
	const metricTitle = getGroupedMetricTitle(chart.type, chartTypeDetails.title, grouping)
	const chartDataset = useMemo(
		() => buildSingleMetricChartDataset(chartState.data, metricTitle, showCumulative && isBarChart),
		[chartState.data, metricTitle, isBarChart, showCumulative]
	)

	const handleCsvExport = () => {
		if (chartDataset.source.length === 0) return
		const headers = [...getCsvPeriodHeaders(grouping), `${itemName} ${metricTitle}`]
		const rows = chartDataset.source.map((row, index) => {
			const timestamp = row[0]
			if (typeof timestamp !== 'number') throw new Error(`Invalid dashboard chart timestamp at index ${index}`)
			return [...getCsvPeriodCells(timestamp / 1e3, grouping), row[1]]
		})
		const fileName = `${itemName}_${chartTypeDetails.title.replace(/\s+/g, '_')}_${
			new Date().toISOString().split('T')[0]
		}.csv`
		downloadCSV(fileName, [headers, ...rows])
	}

	const imageFilename = `${itemName}_${chartTypeDetails.title.replace(/\s+/g, '_')}`
	const imageTitle = `${itemName} ${chartTypeDetails.title}`

	const subjectLabel = chart.subjectType === 'protocol' ? 'Protocol' : chart.chain === 'All' ? 'All chains' : 'Chain'
	const groupingLabel = isGroupable ? DASHBOARD_GROUPING_LABELS[chart.grouping ?? 'day'] : null

	return (
		<div className="flex min-h-[calc(344px*var(--card-scale,1))] flex-col p-0 md:min-h-[calc(360px*var(--card-scale,1))]">
			<ProCardHeader
				title={`${itemName} ${metricTitle}`}
				icon={
					chart.subjectType === 'protocol' || chart.chain !== 'All' ? (
						<EntityIcon src={itemIconUrl} name={itemName} />
					) : null
				}
				badge={<BoundParameterBadge {...(chart.bindings === undefined ? {} : { bindings: chart.bindings })} />}
				subtitle={<ProMeta items={[subjectLabel, groupingLabel]} />}
				controls={
					<>
						{isGroupable ? (
							<ProSegmented
								size="sm"
								label="Grouping"
								options={DASHBOARD_GROUPING_SEGMENTS}
								value={chart.grouping ?? 'day'}
								onValueChange={(value) => handleGroupingChange(chart.id, value)}
							/>
						) : null}
						{isBarChart && !isDailyAverageChartType(chart.type) ? (
							<Select
								size="sm"
								allValues={CUMULATIVE_DISPLAY_OPTIONS}
								selectedValues={showCumulative ? 'Cumulative' : 'Individual'}
								setSelectedValues={(value: string) => {
									handleCumulativeChange(chart.id, value === 'Cumulative')
								}}
								label={showCumulative ? 'Cumulative' : 'Individual'}
								labelType="none"
								variant="pro"
							/>
						) : null}
					</>
				}
				menu={
					chartDataset.source.length > 0
						? {
								image: { chartInstance, filename: imageFilename, title: imageTitle },
								csv: { onClick: handleCsvExport }
							}
						: {}
				}
			/>
			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
				<ChartRenderer
					type={chart.type}
					showCumulative={showCumulative}
					grouping={grouping}
					dataset={chartDataset}
					isLoading={chartState.isLoading}
					hasError={chartState.hasError}
					refetch={chartState.refetch}
					color={chartColor}
					onChartReady={handleChartReady}
				/>
			</div>
		</div>
	)
}
