import type * as echarts from 'echarts/core'
import Router, { useRouter } from 'next/router'
import * as React from 'react'
import { ChartCsvExportButton } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import type { IHBarChartProps } from '~/components/ECharts/HBarChart/types'
import { CHANGE_SCALE_GRADIENT } from '~/components/ECharts/TreemapChart/Market/colors'
import { CHART_DOWN, CHART_UP } from '~/constants/colors'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useStableCallback } from '~/hooks/useStableCallback'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { SurfaceBodyStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { slug } from '~/utils'
import { queryReadFailed } from '~/utils/query'
import { pushShallowQuery } from '~/utils/routerQuery'
import {
	buildTokensMovers,
	buildTokensTreemap,
	prepareTokensMoversCsv,
	prepareTokensTreemapCsv,
	type TokensMoverEntry
} from './chartData'
import {
	getTokensChartQueryValue,
	parseTokensChartState,
	TOKENS_CHANGE_WINDOWS,
	TOKENS_CHART_QUERY_KEYS,
	TOKENS_MOVERS_WINDOWS,
	TOKENS_UNIVERSES,
	TOKENS_UNIVERSE_SIZE,
	type TokensChangeWindow,
	type TokensChartState,
	type TokensMapMode,
	type TokensMoversWindow,
	type TokensUniverse
} from './chartState'
import { useTokensChartDataset } from './queries.client'
import { TokensSourceAvailability } from './SourceAvailability'

const MarketTreemapChart = React.lazy(() => import('~/components/ECharts/TreemapChart/Market'))
const HBarChart = React.lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>

const MAP_HEIGHT = '600px'
const MOVERS_HEIGHT = '360px'
const EXPORT_FILENAME = 'tokens-market-map'

const UNIVERSE_OPTIONS = TOKENS_UNIVERSES.map((universe) => ({ value: universe, label: `Top ${universe}` }))

const CHANGE_WINDOW_OPTIONS = TOKENS_CHANGE_WINDOWS.map((window) => ({ value: window, label: window.toUpperCase() }))

const MOVERS_WINDOW_OPTIONS = TOKENS_MOVERS_WINDOWS.map((window) => ({ value: window, label: window.toUpperCase() }))

const MAP_MODE_OPTIONS: Array<{ value: TokensMapMode; label: string }> = [
	{ value: 'grouped', label: 'Group stables' },
	{ value: 'flat', label: 'Hide stables' }
]

export function TokensChartsSection({
	view,
	filterQueryString,
	sharedControls,
	filterPills
}: {
	view: 'map' | 'movers'
	/** Filter-only query string; the dataset is fetched on demand so the table page load stays small. */
	filterQueryString: string
	sharedControls: React.ReactNode
	filterPills: React.ReactNode
}) {
	const router = useRouter()
	const { universe, colorBy, mapMode, moversWindow } = parseTokensChartState(router.query)
	const chartExport = useGetChartInstance()
	const datasetQuery = useTokensChartDataset(filterQueryString)
	const data = datasetQuery.data

	const setChartQuery = React.useCallback(
		(updates: Partial<TokensChartState>) => {
			const queryUpdates: Record<string, string | undefined> = {}
			for (const key in updates) {
				const stateKey = key as keyof TokensChartState
				queryUpdates[TOKENS_CHART_QUERY_KEYS[stateKey]] = getTokensChartQueryValue(stateKey, updates[stateKey]!)
			}
			void pushShallowQuery(router, queryUpdates)
		},
		[router]
	)

	const universeSize = TOKENS_UNIVERSE_SIZE[universe]
	const treemap = React.useMemo(
		() =>
			view === 'map' && data
				? buildTokensTreemap(data, { colorWindow: colorBy, mapMode, universe: universeSize })
				: null,
		[colorBy, data, mapMode, universeSize, view]
	)
	const movers = React.useMemo(
		() =>
			view === 'movers' && data ? buildTokensMovers(data, { window: moversWindow, universe: universeSize }) : null,
		[data, moversWindow, universeSize, view]
	)
	const hasRows = data != null && data.marketCaps.length > 0

	return (
		<>
			<TableToolbar>
				{sharedControls}
				<TableToolbarControlGroup>
					<SegmentedControl
						value={universe}
						onValueChange={(next: TokensUniverse) => setChartQuery({ universe: next })}
						options={UNIVERSE_OPTIONS}
						label="Tokens by market cap"
						variant="default"
						size="md"
					/>
					{view === 'map' ? (
						<>
							<SegmentedControl
								value={colorBy}
								onValueChange={(next: TokensChangeWindow) => setChartQuery({ colorBy: next })}
								options={CHANGE_WINDOW_OPTIONS}
								label="Price change window"
								variant="default"
								size="md"
							/>
							<SegmentedControl
								value={mapMode}
								onValueChange={(next: TokensMapMode) => setChartQuery({ mapMode: next })}
								options={MAP_MODE_OPTIONS}
								label="Stablecoins display"
								variant="default"
								size="md"
							/>
							{treemap && treemap.treeData.length > 0 ? (
								<>
									<ChartRestoreButton chartInstance={chartExport.chartInstance} />
									<ChartExportButtons
										chart={chartExport}
										filename={EXPORT_FILENAME}
										title="Tokens market map"
										csvSource={{
											type: 'prepare-csv',
											prepare: () =>
												prepareTokensTreemapCsv({
													leaves: treemap.leaves,
													colorWindow: colorBy,
													filename: EXPORT_FILENAME
												})
										}}
										pngProfile="treemapNormalized"
										smol
									/>
								</>
							) : null}
						</>
					) : (
						<>
							<SegmentedControl
								value={moversWindow}
								onValueChange={(next: TokensMoversWindow) => setChartQuery({ moversWindow: next })}
								options={MOVERS_WINDOW_OPTIONS}
								label="Price change window"
								variant="default"
								size="md"
							/>
							{/* One file for both lists, with a Direction column; each chart's .png sits on its own title. */}
							{movers && (movers.gainers.length > 0 || movers.losers.length > 0) ? (
								<ChartCsvExportButton
									chart={chartExport}
									filename={`tokens-movers-${moversWindow}-top-${universe}`}
									source={{
										type: 'prepare-csv',
										prepare: () =>
											prepareTokensMoversCsv({
												movers,
												window: moversWindow,
												filename: `tokens-movers-${moversWindow}-top-${universe}`
											})
									}}
								/>
							) : null}
						</>
					)}
				</TableToolbarControlGroup>
			</TableToolbar>
			{filterPills}
			{datasetQuery.data ? <TokensSourceAvailability sources={datasetQuery.data.unavailableSources} /> : null}
			{queryReadFailed(datasetQuery) ? (
				<SurfaceBodyStatus variant="error" retry={datasetQuery} style={{ height: MAP_HEIGHT }}>
					Couldn&apos;t load chart data.
				</SurfaceBodyStatus>
			) : data == null ? (
				<SurfaceBodyLoadingStatus label="Loading chart" style={{ height: MAP_HEIGHT }} />
			) : !hasRows ? (
				<SurfaceBodyStatus variant="empty" style={{ height: MAP_HEIGHT }}>
					No tokens match the current filters.
				</SurfaceBodyStatus>
			) : treemap ? (
				<>
					<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" style={{ height: MAP_HEIGHT }} />}>
						<MarketTreemapChart
							treeData={treemap.treeData}
							leaves={treemap.leaves}
							sizeLabel="Market Cap"
							colorLabel={`Price ${colorBy}`}
							valueSymbol="$"
							height={MAP_HEIGHT}
							showMarketCapRow={false}
							groupItemsLabel="Tokens"
							exportButtons={chartExport}
						/>
					</React.Suspense>
					<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pb-2 body-sm text-tertiary">
						{treemap.stablecoinsHidden > 0 ? <p>{treemap.stablecoinsHidden} stablecoins hidden</p> : null}
						<div
							className="ml-auto w-40 shrink-0 body-sm"
							role="img"
							aria-label={`Treemap color scale: loss through zero to gain for price ${colorBy}`}
						>
							<div className="h-1.5 rounded-full border border-subtle" style={{ background: CHANGE_SCALE_GRADIENT }} />
							<div className="flex justify-between pt-0.5">
								<span>Loss</span>
								<span>0%</span>
								<span>Gain</span>
							</div>
						</div>
					</div>
				</>
			) : movers ? (
				<div className="grid grid-cols-1 lg:grid-cols-2">
					<MoversChart
						title="Top gainers"
						exportName={`${moversWindow}-top-${universe}`}
						entries={movers.gainers}
						color={CHART_UP}
					/>
					<MoversChart
						title="Top losers"
						exportName={`${moversWindow}-top-${universe}`}
						className="border-t border-subtle lg:border-t-0 lg:border-l"
						entries={movers.losers}
						color={CHART_DOWN}
					/>
				</div>
			) : null}
		</>
	)
}

function MoversChart({
	title,
	exportName,
	className,
	entries,
	color
}: {
	title: string
	/** The window and universe the bars show, as a filename part such as `7d-top-100`. */
	exportName: string
	className?: string
	entries: Array<TokensMoverEntry>
	color: string
}) {
	const chartExport = useGetChartInstance()
	// ECharts calls this on a bar click, so it reads the bars shown now, after any filter change.
	const openEntry = useStableCallback((dataIndex: number) => {
		const href = entries[dataIndex]?.href
		if (href) void Router.push(href)
	})
	const chartData = React.useMemo(() => {
		const categories: Array<string> = []
		const values: Array<number> = []
		const logos: Array<string> = []
		for (const entry of entries) {
			categories.push(entry.name)
			values.push(entry.value)
			logos.push(entry.logo)
		}
		return { categories, values, logos }
	}, [entries])

	const handleReady = React.useCallback(
		(instance: echarts.ECharts | null) => {
			if (!instance) return
			instance.off('click')
			instance.on('click', (params) => openEntry(params.dataIndex))
		},
		[openEntry]
	)

	return (
		<div className={`flex min-w-0 flex-col ${className ?? ''}`.trim()}>
			<div className="flex items-center justify-between gap-2 px-3 pt-2">
				<h3 className="label-md">{title}</h3>
				<ChartPngExportButton
					chart={chartExport}
					filename={`tokens-${slug(title)}-${exportName}`}
					title={`Tokens ${title}`}
					pngProfile="hbar"
					disabled={entries.length === 0}
				/>
			</div>
			{entries.length === 0 ? (
				<div className="flex items-center justify-center body-sm text-tertiary" style={{ height: MOVERS_HEIGHT }}>
					Nothing to show
				</div>
			) : (
				<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" style={{ height: MOVERS_HEIGHT }} />}>
					<HBarChart
						categories={chartData.categories}
						values={chartData.values}
						color={color}
						logos={chartData.logos}
						valueSymbol="%"
						height={MOVERS_HEIGHT}
						exportButtons={chartExport}
						onReady={handleReady}
					/>
				</React.Suspense>
			)}
		</div>
	)
}
