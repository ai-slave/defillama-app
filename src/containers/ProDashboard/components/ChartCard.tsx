import type * as echarts from 'echarts/core'
import { lazy, Suspense, useMemo, useState } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { createSingleSeriesChartOptions } from '~/components/ECharts/timeSeriesChartOptions'
import type { IMultiSeriesChart2Props, MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import { Select } from '~/components/Select/Select'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { capitalizeFirstLetter, toNiceDayMonthYear } from '~/utils'
import { download } from '~/utils/download'
import { useChartImageExport } from '../hooks/useChartImageExport'
import {
	useProDashboardCatalog,
	useProDashboardEditorActions,
	useProDashboardPermissions
} from '../ProDashboardAPIContext'
import { type Chain, CHART_TYPES, type ChartConfig, type DashboardGrouping, type Protocol } from '../types'
import { generateChartColor, getItemIconUrl } from '../utils'
import { LoadingSpinner } from './LoadingSpinner'
import { ProTableCSVButton } from './ProTable/CsvButton'
import { buildSingleMetricChartDataset } from './singleMetricChart'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>

interface ChartCardProps {
	chart: ChartConfig
}

interface ChartRendererProps {
	type: ChartConfig['type']
	showCumulative: ChartConfig['showCumulative']
	dataset: MultiSeriesChart2Dataset
	isLoading: boolean
	hasError: boolean
	refetch: () => void
	color: string
	onChartReady: (instance: echarts.ECharts | null) => void
}

const userMetricTypes = ['users', 'activeUsers', 'newUsers', 'txs', 'gasUsed']
const percentMetricTypes = ['medianApy']
const ratioMetricTypes = ['pfRatio', 'psRatio']
const CUMULATIVE_DISPLAY_OPTIONS = [
	{ name: 'Show individual values', key: 'Individual' },
	{ name: 'Show cumulative values', key: 'Cumulative' }
]

function ChartRenderer({
	type,
	showCumulative = false,
	dataset,
	isLoading,
	hasError,
	refetch,
	color,
	onChartReady
}: ChartRendererProps) {
	const chartType = CHART_TYPES[type]
	const [todayTimestamp] = useState(() => Math.floor(Date.now() / 1000))
	const valueSymbol =
		userMetricTypes.includes(type) || ratioMetricTypes.includes(type)
			? ''
			: percentMetricTypes.includes(type)
				? '%'
				: '$'
	const chartOptions = useMemo(() => createSingleSeriesChartOptions(valueSymbol), [valueSymbol])
	const seriesName = dataset.dimensions[1]
	const charts = useMemo<NonNullable<IMultiSeriesChart2Props['charts']>>(() => {
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

	if (isLoading) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<LoadingSpinner />
			</div>
		)
	}

	if (hasError) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center">
				<Icon name="alert-triangle" height={24} width={24} className="text-sub-orange" />
				<p className="text-pro-text-form">Error loading data</p>
				<button className="text-sm text-link hover:underline" onClick={() => refetch()}>
					Try again
				</button>
			</div>
		)
	}

	if (dataset.source.length === 0) {
		return <p className="flex flex-1 items-center justify-center text-pro-text-form">No data available</p>
	}

	const todayHallmarks: [number, string][] | null =
		type === 'unlocks' ? [[todayTimestamp, toNiceDayMonthYear(todayTimestamp)]] : null

	return (
		<Suspense fallback={<div className="h-[300px]" />}>
			<MultiSeriesChart2
				dataset={dataset}
				charts={charts}
				valueSymbol={valueSymbol}
				height={type === 'unlocks' ? '360px' : '300px'}
				hideDataZoom
				hallmarks={todayHallmarks}
				hallmarkStyle="mark-line"
				chartOptions={chartOptions}
				exportButtons="hidden"
				onReady={onChartReady}
			/>
		</Suspense>
	)
}

const groupingOptions: DashboardGrouping[] = ['day', 'week', 'month', 'quarter', 'year']

export function ChartCard({ chart }: ChartCardProps) {
	const { getChainInfo, getProtocolInfo, protocols } = useProDashboardCatalog()
	const { handleGroupingChange, handleCumulativeChange } = useProDashboardEditorActions()
	const { isReadOnly } = useProDashboardPermissions()
	const { chartInstance, handleChartReady } = useChartImageExport()

	const { itemName, itemIconUrl, chartTypeDetails, isGroupable, isBarChart, showCumulative, chartColor } =
		useMemo(() => {
			const chartTypeDetails = CHART_TYPES[chart.type]
			const isGroupable = chartTypeDetails?.groupable
			const isBarChart = chartTypeDetails?.chartType === 'bar'
			const showCumulative = chart.showCumulative || false

			let itemName: string = ''
			let itemIconUrl: string | undefined = undefined
			let itemInfo: Chain | Protocol | undefined
			let itemIdentifier: string = ''
			if (chart.protocol) {
				itemInfo = getProtocolInfo(chart.protocol)
				itemName = itemInfo?.name || chart.protocol
				itemIconUrl = getItemIconUrl('protocol', itemInfo, chart.protocol)
				itemIdentifier = chart.protocol
			} else if (chart.chain) {
				itemInfo = getChainInfo(chart.chain)
				itemName = chart.chain
				itemIconUrl = getItemIconUrl('chain', itemInfo, chart.chain)
				itemIdentifier = chart.chain
			} else if (chart.geckoId) {
				const protocolInfo = protocols.find((protocol) => protocol.geckoId === chart.geckoId)
				itemInfo = protocolInfo
				itemName = protocolInfo?.name || chart.geckoId
				itemIconUrl = protocolInfo ? getItemIconUrl('protocol', protocolInfo, protocolInfo.slug) : undefined
				itemIdentifier = chart.geckoId
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
		}, [chart, getChainInfo, getProtocolInfo, protocols])

	const chartDataset = useMemo(
		() => buildSingleMetricChartDataset(chart.data, chartTypeDetails.title, showCumulative && isBarChart),
		[chart.data, chartTypeDetails.title, isBarChart, showCumulative]
	)

	const handleCsvExport = () => {
		if (chartDataset.source.length === 0) return
		const headers = ['Date', `${itemName} ${chartTypeDetails.title}`]
		const valueKey = chartDataset.dimensions[1]
		const rows = chartDataset.source.map((row) => [
			new Date(row.timestamp as number).toISOString().slice(0, 10),
			row[valueKey]
		])
		const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n')
		const fileName = `${itemName}_${chartTypeDetails.title.replace(/\s+/g, '_')}_${
			new Date().toISOString().split('T')[0]
		}.csv`
		download(fileName, csvContent)
	}

	const imageFilename = `${itemName}_${chartTypeDetails.title.replace(/\s+/g, '_')}`
	const imageTitle = `${itemName} ${chartTypeDetails.title}`

	return (
		<div className="flex min-h-[344px] flex-col p-1 md:min-h-[360px]">
			<div className="flex flex-wrap items-center justify-end gap-2 p-1 md:p-3">
				<div className="mr-auto flex items-center gap-1">
					{chart.chain !== 'All' ? (
						itemIconUrl ? (
							<img src={itemIconUrl} alt={itemName} width={20} height={20} className="size-5 shrink-0 rounded-full" />
						) : (
							<div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-300 text-xs text-secondary">
								{itemName?.charAt(0)?.toUpperCase()}
							</div>
						)
					) : null}
					<h2 className="text-base font-semibold">
						{itemName} {chartTypeDetails.title}
					</h2>
				</div>
				<div className="flex flex-wrap items-center justify-end gap-2">
					{!isReadOnly ? (
						<>
							{isGroupable ? (
								<div className="flex w-fit flex-nowrap items-center overflow-x-auto rounded-md border border-pro-form-control-border text-pro-text-form">
									{groupingOptions.map((dataInterval) => (
										<Tooltip
											content={capitalizeFirstLetter(dataInterval)}
											render={<button />}
											className="shrink-0 px-2 py-1 text-xs whitespace-nowrap hover:not-disabled:pro-btn-primary focus-visible:not-disabled:pro-btn-primary data-[active=true]:bg-pro-accent data-[active=true]:font-medium data-[active=true]:text-on-brand"
											data-active={chart.grouping === dataInterval}
											onClick={() => handleGroupingChange(chart.id, dataInterval)}
											key={`${chart.id}-options-groupBy-${dataInterval}`}
										>
											{dataInterval.slice(0, 1).toUpperCase()}
										</Tooltip>
									))}
								</div>
							) : null}
							{isBarChart ? (
								<Select
									size="sm"
									allValues={CUMULATIVE_DISPLAY_OPTIONS}
									selectedValues={showCumulative ? 'Cumulative' : 'Individual'}
									setSelectedValues={(value) => {
										handleCumulativeChange(chart.id, value === 'Cumulative')
									}}
									label={showCumulative ? 'Cumulative' : 'Individual'}
									labelType="none"
									variant="pro"
								/>
							) : null}
						</>
					) : null}
					{chartDataset.source.length > 0 ? (
						<>
							<ChartPngExportButton chartInstance={chartInstance} filename={imageFilename} title={imageTitle} smol />
							<ProTableCSVButton
								onClick={handleCsvExport}
								smol
								className="flex items-center gap-1 rounded-md border border-pro-form-control-border px-1.5 py-1 text-xs hover:border-transparent hover:not-disabled:pro-btn-primary focus-visible:border-transparent focus-visible:not-disabled:pro-btn-primary disabled:border-pro-cards-border disabled:text-tertiary"
							/>
						</>
					) : null}
				</div>
			</div>
			<ChartRenderer
				type={chart.type}
				showCumulative={chart.showCumulative}
				dataset={chartDataset}
				isLoading={chart.isLoading}
				hasError={chart.hasError}
				refetch={chart.refetch}
				color={chartColor}
				onChartReady={handleChartReady}
			/>
		</div>
	)
}
