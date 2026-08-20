import { useRouter } from 'next/router'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type {
	MultiSeriesChartSeriesConfig,
	MultiSeriesTimeSeriesDataset
} from '~/components/ECharts/MultiSeriesChart/types'
import {
	ChartGroupingSelector,
	DWM_GROUPING_OPTIONS_LOWERCASE
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { CHART_COLORS } from '~/constants/colors'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { formatDate } from '~/utils/dateFormat'
import { formatPercent } from '~/utils/numberFormat'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import {
	buildDexSpotShareMethodology,
	buildDexSpotShareDataset,
	type CexSpotVolumeSeries,
	DEFAULT_DEX_SPOT_SHARE_GROUPING,
	parseDexSpotShareGrouping
} from './dexSpotShare'
import type { IAdapterByChainPageData } from './types'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const GROUPING_QUERY_KEY = 'spotShareGroupBy'
const CHART_TITLE = 'DEX Share of Spot Volume'
const EMPTY_DATASET: MultiSeriesTimeSeriesDataset = { dimensions: ['timestamp', 'DEX Share'], source: [] }
const CHARTS: MultiSeriesChartSeriesConfig[] = [
	{
		type: 'line',
		name: 'DEX Share',
		encode: { x: 0, y: 1 },
		color: CHART_COLORS[0],
		hideAreaStyle: true,
		showSymbol: false
	}
]

function chartAriaLabel(dataset: ReturnType<typeof buildDexSpotShareDataset>, methodology: string): string {
	const first = dataset.source.find((row) => row[1] != null)
	const last = dataset.source.findLast((row) => row[1] != null)
	if (!first || !last) return `${CHART_TITLE}. ${methodology} No observations are available.`

	const firstValue = formatPercent(first[1] as number, { input: 'percent', maximumFractionDigits: 2 })
	const lastValue = formatPercent(last[1] as number, { input: 'percent', maximumFractionDigits: 2 })
	return `${CHART_TITLE}. ${methodology} From ${firstValue} on ${formatDate(first[0], { input: 'milliseconds' })} to ${lastValue} on ${formatDate(last[0], { input: 'milliseconds' })}.`
}

export function DexSpotShareChart({
	dexVolume,
	cexVolume,
	dexProtocolCount,
	cexVenueCount
}: {
	dexVolume: IAdapterByChainPageData['chartData']
	cexVolume: CexSpotVolumeSeries | null
	dexProtocolCount: number
	cexVenueCount: number | null
}) {
	const router = useRouter()
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const groupBy = parseDexSpotShareGrouping(readSingleQueryValue(router.query[GROUPING_QUERY_KEY]))
	const methodology = buildDexSpotShareMethodology({ dexProtocolCount, cexVenueCount })
	const dataset = React.useMemo(
		() =>
			cexVolume
				? buildDexSpotShareDataset({
						dexVolume,
						cexVolume,
						groupBy
					})
				: EMPTY_DATASET,
		[dexVolume, cexVolume, groupBy]
	)
	const hasData = dataset.source.some((row) => row[1] != null)

	return (
		<ChartPanel>
			<ChartPanelToolbar className="items-start">
				<div className="mr-auto flex min-w-0 basis-full flex-col md:basis-auto">
					<h2 className="heading-xs">{CHART_TITLE}</h2>
					<p className="body-sm text-secondary">{methodology}</p>
				</div>
				<ChartGroupingSelector
					value={groupBy}
					onValueChange={(nextGroupBy) => {
						void pushShallowQuery(router, {
							[GROUPING_QUERY_KEY]: nextGroupBy === DEFAULT_DEX_SPOT_SHARE_GROUPING ? undefined : nextGroupBy
						})
					}}
					options={DWM_GROUPING_OPTIONS_LOWERCASE}
				/>
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={`dex-share-of-spot-volume-${groupBy}`}
					title={CHART_TITLE}
					csvSource={hasData ? { type: 'dataset', dataset } : null}
				/>
			</ChartPanelToolbar>
			{hasData ? (
				<React.Suspense fallback={<ChartPanelBodyFallback />}>
					<ChartPanelBody role="img" aria-label={chartAriaLabel(dataset, methodology)}>
						<MultiSeriesChart
							dataset={dataset}
							charts={CHARTS}
							chartOptions={{ yAxis: { min: 0 } }}
							valueSymbol="%"
							groupBy={groupBy}
							height="360px"
							hideDefaultLegend
							exportButtons="hidden"
							onReady={handleChartReady}
						/>
					</ChartPanelBody>
				</React.Suspense>
			) : (
				<ChartPanelBodyFallback className="body-sm text-secondary" role="status">
					DEX and CEX spot volume do not have overlapping data for this chart.
				</ChartPanelBodyFallback>
			)}
		</ChartPanel>
	)
}
