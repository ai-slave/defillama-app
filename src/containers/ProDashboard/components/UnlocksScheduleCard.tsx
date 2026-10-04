import { useQuery } from '@tanstack/react-query'
import { lazy, type ReactNode, Suspense, useContext, useMemo, useState } from 'react'
import { selectDatasetColumns } from '~/components/ECharts/MultiSeriesChart/selection'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { formatUnlockDate } from '~/containers/Unlocks/dateFormat'
import { getProtocolEmissionsScheduleData } from '~/containers/Unlocks/queries'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { slug } from '~/utils'
import { queryReadFailed } from '~/utils/query'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import { StreamDoneContext } from '../queries'
import type { UnlocksScheduleConfig } from '../types'
import { ProMeta } from '../ui'
import { BoundParameterBadge } from './BoundParameterBadge'
import { scaledPx, useCardHeightScale } from './cardHeightContext'
import { prepareProChartCsv } from './chartCsv'
import { filterChartDatasetByTimePeriod } from './datasets/filterChartDataset'
import { ProCardHeader } from './ProCardHeader'
import { ProCardEmpty, ProCardError, ProCardLoading, ProCardRefreshFailed } from './ProCardStatus'
import { useChartSyncGroup } from './useChartSyncGroup'
import { useDashboardAnnotationHallmarks } from './useDashboardAnnotationHallmarks'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const EMPTY_STACKS: Array<string> = []
const EMPTY_DATASET: MultiSeriesChartDataset = { source: [], dimensions: ['timestamp'] }

interface UnlocksScheduleCardProps {
	config: UnlocksScheduleConfig
}

export function UnlocksScheduleCard({ config }: UnlocksScheduleCardProps) {
	const { protocol, protocolName, dataType } = config
	const resolvedDataType = dataType === 'realtime' ? 'documented' : dataType
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { chartInstance, handleChartReady } = useChartImageExport()
	const [todayTimestamp] = useState(() => Math.floor(Date.now() / 1000))
	const todayHallmarks = useMemo<Array<[number, string]>>(
		() => [[todayTimestamp, formatUnlockDate(todayTimestamp)]],
		[todayTimestamp]
	)

	const streamDone = useContext(StreamDoneContext)
	const scheduleQuery = useQuery({
		queryKey: ['pro-dashboard', 'unlocks-schedule', protocol, resolvedDataType],
		queryFn: () => getProtocolEmissionsScheduleData(slug(protocol)),
		enabled: streamDone && Boolean(protocol),
		staleTime: 60 * 60 * 1000
	})
	const { data, isLoading } = scheduleQuery
	const readFailed = queryReadFailed(scheduleQuery)

	// Pre-built from the API — no need to reconstruct dataset/charts from scratch.
	const apiDataset = data?.datasets?.[resolvedDataType] ?? EMPTY_DATASET
	const apiCharts = data?.chartsConfigs?.[resolvedDataType]

	const stacks = useMemo(() => {
		if (apiCharts?.length) return apiCharts.map((chart) => chart.name)
		const categories = data?.categories?.[resolvedDataType] ?? EMPTY_STACKS
		if (categories.length > 0) return categories
		return EMPTY_STACKS
	}, [apiCharts, data, resolvedDataType])
	const {
		activeSeries: activeCategories,
		selectedCharts: selectedChartsSet,
		setSelectedSeries
	} = useLocalSelection({
		availableSeries: stacks,
		scope: `${protocol}:${resolvedDataType}`
	})

	// Apply time-period filtering on the pre-built dataset source
	const dataset = useMemo(
		() => filterChartDatasetByTimePeriod(apiDataset, timePeriod, customTimePeriod),
		[apiDataset, timePeriod, customTimePeriod]
	)

	const hasChartData = dataset.source.length > 0 && stacks.length > 0
	const imageTitle = `${protocolName} Unlocks Schedule`
	const imageFilename = `${protocolName || protocol}-unlock-schedule-${resolvedDataType}`

	const prepareCsvExport = () =>
		prepareProChartCsv(
			selectDatasetColumns(
				dataset,
				stacks.filter((stack) => selectedChartsSet.has(stack))
			),
			`${protocolName || protocol}-unlock-schedule-${resolvedDataType}`
		)

	const hallmarks = useDashboardAnnotationHallmarks(todayHallmarks)
	const syncGroup = useChartSyncGroup()
	const cardHeightScale = useCardHeightScale()
	const chartHeight = scaledPx(360, cardHeightScale)

	const title = `${protocolName} Unlocks Schedule`
	const dataTypeLabel = config.dataType === 'documented' ? 'Documented' : 'Realtime'

	const renderStatusShell = (status: ReactNode) => (
		<div className="flex min-h-[calc(422px*var(--card-scale,1))] flex-col p-0 md:min-h-[calc(438px*var(--card-scale,1))]">
			<ProCardHeader titleAs="h3" title={title} subtitle={<ProMeta items={[dataTypeLabel]} />} />
			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3" style={{ minHeight: chartHeight }}>
				{status}
			</div>
		</div>
	)

	if (readFailed && data === undefined) {
		return renderStatusShell(<ProCardError retry={scheduleQuery} />)
	}

	if (isLoading || (!streamDone && data === undefined)) {
		return renderStatusShell(<ProCardLoading />)
	}

	return (
		<div className="flex min-h-[calc(422px*var(--card-scale,1))] flex-col p-0 md:min-h-[calc(438px*var(--card-scale,1))]">
			{readFailed ? <ProCardRefreshFailed retry={scheduleQuery} /> : null}
			<ProCardHeader
				titleAs="h3"
				title={title}
				badge={<BoundParameterBadge {...(config.bindings === undefined ? {} : { bindings: config.bindings })} />}
				subtitle={<ProMeta items={[dataTypeLabel]} />}
				viewerControls={
					hasChartData && stacks.length > 1 ? (
						<SelectWithCombobox
							size="sm"
							allValues={stacks}
							selectedValues={activeCategories}
							setSelectedValues={setSelectedSeries}
							label="Category"
							labelType="smol"
							variant="filter"
						/>
					) : null
				}
				menu={
					hasChartData
						? {
								image: { chartInstance, filename: imageFilename, title: imageTitle },
								csv: { prepareCsv: prepareCsvExport }
							}
						: {}
				}
			/>
			<div className="px-3 pb-3">
				{hasChartData ? (
					<Suspense fallback={<div className="min-h-[calc(360px*var(--card-scale,1))]" />}>
						<MultiSeriesChart
							dataset={dataset}
							height={chartHeight}
							{...(apiCharts === undefined ? {} : { charts: apiCharts })}
							selectedCharts={selectedChartsSet}
							{...(hallmarks ? { hallmarks } : {})}
							hallmarkStyle="mark-line"
							{...(syncGroup ? { syncGroup } : {})}
							hideDataZoom
							valueSymbol=""
							onReady={handleChartReady}
						/>
					</Suspense>
				) : (
					<div className="flex h-[calc(360px*var(--card-scale,1))] flex-col justify-center">
						<ProCardEmpty message="No unlocks data available." />
					</div>
				)}
			</div>
		</div>
	)
}
