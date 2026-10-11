import type * as echarts from 'echarts/core'
import { lazy, Suspense, useContext, useMemo, useState } from 'react'
import { createSingleSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { Select } from '~/components/Select/Select'
import { formatUnlockDate } from '~/containers/Unlocks/dateFormat'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { downloadCSV } from '~/utils/download'
import type { QueryRetry } from '~/utils/query'
import { getChartDataPrerequisite, toChartRuntimeState } from '../chartRuntime'
import {
	useDashboardEntityColors,
	useProDashboardCatalog,
	useProDashboardEditorActions,
	useProDashboardTime
} from '../ProDashboardAPIContext'
import { ProxyAuthTokenContext, StreamDoneContext, useChartData } from '../queries'
import { type ChartConfig, type DashboardGrouping, getDashboardChartValueSymbol } from '../types'
import { ProMeta } from '../ui'
import { DASHBOARD_CHART_GROUPING, getCsvPeriodCells, getCsvPeriodHeaders, getItemIconUrl } from '../utils'
import { getChartEntityKey } from '../utils/colorManager'
import { BoundParameterBadge } from './BoundParameterBadge'
import { useCardHeightScale, scaledPx } from './cardHeightContext'
import { DASHBOARD_GROUPING_LABELS, DASHBOARD_GROUPING_SEGMENTS } from './dashboardGroupingSegments'
import { EntityIcon } from './EntityIcon'
import { ProCardHeader } from './ProCardHeader'
import { ProCardEmpty, ProCardError, ProCardLoading } from './ProCardStatus'
import { buildSingleMetricChartDataset, getSingleMetricPresentation } from './singleMetricChart'
import { useChartSyncGroup } from './useChartSyncGroup'
import { useDashboardAnnotationHallmarks } from './useDashboardAnnotationHallmarks'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

interface ChartCardProps {
	chart: ChartConfig
}

interface ChartRendererProps {
	type: ChartConfig['type']
	seriesType: 'bar' | 'line'
	grouping: DashboardGrouping
	dataset: MultiSeriesChartDataset
	isLoading: boolean
	hasError: boolean
	retry: QueryRetry
	color: string
	onChartReady: (instance: echarts.ECharts | null) => void
}

const CUMULATIVE_DISPLAY_OPTIONS = [
	{ name: 'Show individual values', key: 'Individual' },
	{ name: 'Show cumulative values', key: 'Cumulative' }
]

function ChartRenderer({
	type,
	seriesType,
	grouping,
	dataset,
	isLoading,
	hasError,
	retry,
	color,
	onChartReady
}: ChartRendererProps) {
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
				type: seriesType,
				name: seriesName,
				encode: { x: 'timestamp', y: seriesName },
				color,
				stack: 'value'
			}
		]
	}, [color, seriesName, seriesType])

	const todayLine = useMemo<Array<[number, string]> | undefined>(
		() => (type === 'unlocks' ? [[todayTimestamp, formatUnlockDate(todayTimestamp)]] : undefined),
		[todayTimestamp, type]
	)
	const hallmarks = useDashboardAnnotationHallmarks()
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
		return <ProCardError retry={retry} />
	}

	if (dataset.source.length === 0) {
		return <ProCardEmpty message="No data available" />
	}

	return (
		<Suspense
			fallback={
				<div className="flex flex-1 flex-col" style={{ minHeight: chartHeight }}>
					<ProCardLoading label="Loading chart" />
				</div>
			}
		>
			<MultiSeriesChart
				dataset={dataset}
				charts={charts}
				valueSymbol={valueSymbol}
				height={chartHeight}
				hideDataZoom
				{...(hallmarks ? { hallmarks } : {})}
				{...(todayLine ? { referenceLines: todayLine } : {})}
				{...(syncGroup ? { syncGroup } : {})}
				{...(chartOptions ? { chartOptions } : {})}
				exportButtons="hidden"
				onReady={onChartReady}
			/>
		</Suspense>
	)
}

export function ChartCard({ chart }: ChartCardProps) {
	const { getChainInfo, getProtocolInfo, protocolRelations, protocolBySlug, protocolCatalog } = useProDashboardCatalog()
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { handleGroupingChange, handleCumulativeChange } = useProDashboardEditorActions()
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const entityColors = useDashboardEntityColors()
	const authToken = useContext(ProxyAuthTokenContext)
	const streamDone = useContext(StreamDoneContext)
	const chartQuery = useChartData(
		chart,
		protocolCatalog,
		protocolBySlug,
		timePeriod,
		customTimePeriod,
		authToken,
		protocolRelations
	)
	const chartState = toChartRuntimeState(
		chartQuery,
		streamDone,
		getChartDataPrerequisite(chart, protocolCatalog, protocolBySlug)
	)

	const presentation = getSingleMetricPresentation(chart)
	const { details: chartTypeDetails, isGroupable, grouping, metricTitle } = presentation
	const { itemName, itemIconUrl } = useMemo(() => {
		if (chart.subjectType === 'protocol') {
			const itemInfo = getProtocolInfo(chart.protocol)
			return {
				itemName: itemInfo?.name || chart.protocol,
				itemIconUrl: getItemIconUrl('protocol', itemInfo, chart.protocol)
			}
		}
		return { itemName: chart.chain, itemIconUrl: getItemIconUrl('chain', getChainInfo(chart.chain), chart.chain) }
	}, [chart, getChainInfo, getProtocolInfo])
	const chartColor = chart.color ?? entityColors[getChartEntityKey(chart)]

	const chartDataset = buildSingleMetricChartDataset(chartState.data, metricTitle, presentation.cumulative)

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
							<SegmentedControl
								variant="default"
								size="sm"
								label="Grouping"
								options={DASHBOARD_GROUPING_SEGMENTS}
								value={chart.grouping ?? 'day'}
								onValueChange={(value) => handleGroupingChange(chart.id, value)}
							/>
						) : null}
						{presentation.offersCumulative ? (
							<Select
								heading="Display"
								size="sm"
								allValues={CUMULATIVE_DISPLAY_OPTIONS}
								selectedValues={presentation.cumulative ? 'Cumulative' : 'Individual'}
								setSelectedValues={(value: string) => {
									handleCumulativeChange(chart.id, value === 'Cumulative')
								}}
								label={presentation.cumulative ? 'Cumulative' : 'Individual'}
								labelType="none"
								variant="filter"
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
					seriesType={presentation.seriesType}
					grouping={grouping}
					dataset={chartDataset}
					isLoading={chartState.isLoading}
					hasError={chartState.hasError}
					retry={chartState}
					color={chartColor}
					onChartReady={handleChartReady}
				/>
			</div>
		</div>
	)
}
