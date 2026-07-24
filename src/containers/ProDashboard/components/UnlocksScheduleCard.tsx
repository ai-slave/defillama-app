import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useCallback, useContext, useMemo, useState } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { formatUnlockDate } from '~/containers/Unlocks/dateFormat'
import { getProtocolEmissionsScheduleData } from '~/containers/Unlocks/queries'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { useSeriesSelection } from '~/hooks/useSeriesSelection'
import { slug } from '~/utils'
import { formatIsoDate } from '~/utils/dateFormat'
import { download } from '~/utils/download'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import { StreamDoneContext } from '../queries'
import type { UnlocksScheduleConfig } from '../types'
import { filterChartDatasetByTimePeriod } from './datasets/filterChartDataset'
import { LoadingSpinner } from './LoadingSpinner'
import { ProTableCSVButton } from './ProTable/CsvButton'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const EMPTY_STACKS: string[] = []
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
	const todayHallmarks = useMemo<[number, string][]>(
		() => [[todayTimestamp, formatUnlockDate(todayTimestamp)]],
		[todayTimestamp]
	)

	const streamDone = useContext(StreamDoneContext)
	const { data, isLoading } = useQuery({
		queryKey: ['pro-dashboard', 'unlocks-schedule', protocol, resolvedDataType],
		queryFn: () => getProtocolEmissionsScheduleData(slug(protocol)),
		enabled: streamDone && Boolean(protocol),
		staleTime: 60 * 60 * 1000
	})

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
	} = useSeriesSelection({
		availableSeries: stacks,
		selectionKey: `${protocol}:${resolvedDataType}`
	})

	// Apply time-period filtering on the pre-built dataset source
	const dataset = useMemo(
		() => filterChartDatasetByTimePeriod(apiDataset, timePeriod, customTimePeriod),
		[apiDataset, timePeriod, customTimePeriod]
	)

	const hasChartData = dataset.source.length > 0 && stacks.length > 0
	const imageTitle = `${protocolName} Unlocks Schedule`
	const imageFilename = `${protocolName || protocol}-unlock-schedule-${resolvedDataType}`

	const handleCsvExport = useCallback(() => {
		if (!hasChartData) return
		const selectedDimensionIndexes = activeCategories.map((name) => dataset.dimensions.indexOf(name))
		const headers = ['Date', ...activeCategories]
		const rows = dataset.source.map((item) => {
			return [
				formatIsoDate(item[0] as number, { input: 'milliseconds' }) ?? '',
				...selectedDimensionIndexes.map((index) => item[index] ?? '')
			]
		})
		const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n')
		const filename = `${protocolName || protocol}-unlock-schedule-${resolvedDataType}`
		download(filename, csvContent)
	}, [hasChartData, activeCategories, dataset, protocolName, protocol, resolvedDataType])

	if (isLoading || !streamDone) {
		return (
			<div className="flex min-h-[422px] items-center justify-center md:min-h-[438px]">
				<LoadingSpinner />
			</div>
		)
	}

	return (
		<div className="flex min-h-[422px] flex-col p-2 md:min-h-[438px]">
			<div className="mb-2 flex items-start justify-between gap-2">
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-semibold text-pro-text-primary">{protocolName} Unlocks Schedule </h3>
				</div>
				{hasChartData ? (
					<div className="flex flex-wrap justify-end gap-2">
						{stacks.length > 1 ? (
							<SelectWithCombobox
								size="sm"
								allValues={stacks}
								selectedValues={activeCategories}
								setSelectedValues={setSelectedSeries}
								label="Category"
								labelType="smol"
								variant="filter"
								popoverVariant="legacy"
							/>
						) : null}
						<ChartPngExportButton chartInstance={chartInstance} filename={imageFilename} title={imageTitle} smol />
						<ProTableCSVButton
							onClick={handleCsvExport}
							smol
							className="flex items-center gap-1 rounded-md border border-pro-form-control-border px-1.5 py-1 text-xs hover:border-transparent hover:not-disabled:pro-btn-primary focus-visible:border-transparent focus-visible:not-disabled:pro-btn-primary disabled:border-pro-cards-border disabled:text-tertiary"
						/>
					</div>
				) : null}
			</div>
			<div>
				{hasChartData ? (
					<Suspense fallback={<div className="min-h-[360px]" />}>
						<MultiSeriesChart
							dataset={dataset}
							charts={apiCharts}
							selectedCharts={selectedChartsSet}
							hallmarks={todayHallmarks}
							hideDataZoom
							valueSymbol=""
							onReady={handleChartReady}
						/>
					</Suspense>
				) : (
					<div className="flex h-[360px] items-center justify-center text-center text-pro-text-tertiary">
						No unlocks data available.
					</div>
				)}
			</div>
		</div>
	)
}
