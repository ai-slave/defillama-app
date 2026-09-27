import type * as echarts from 'echarts/core'
import Router, { useRouter } from 'next/router'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import type { IHBarChartProps } from '~/components/ECharts/HBarChart/types'
import { EQUITIES_TREEMAP_COLORS } from '~/components/ECharts/TreemapChart/Market/colors'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { LoadingSpinner } from '~/ui/Loaders'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
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
const GAINER_COLOR = '#269f3c'
const LOSER_COLOR = '#942e38'
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
	const { chartInstance, handleChartReady } = useGetChartInstance()
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
									<ChartRestoreButton chartInstance={chartInstance} />
									<ChartExportButtons
										chartInstance={chartInstance}
										filename={EXPORT_FILENAME}
										title="Tokens Market Map"
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
							{movers && (movers.gainers.length > 0 || movers.losers.length > 0) ? (
								<ChartExportButtons
									chartInstance={chartInstance}
									filename={`tokens-movers-${moversWindow}-top-${universe}`}
									csvSource={{
										type: 'prepare-csv',
										prepare: () =>
											prepareTokensMoversCsv({
												movers,
												window: moversWindow,
												filename: `tokens-movers-${moversWindow}-top-${universe}`
											})
									}}
									showPng={false}
									smol
								/>
							) : null}
						</>
					)}
				</TableToolbarControlGroup>
			</TableToolbar>
			{filterPills}
			{datasetQuery.data ? <TokensSourceAvailability sources={datasetQuery.data.unavailableSources} /> : null}
			{data == null ? (
				<ChartPanelBodyFallback
					role={datasetQuery.isError ? 'alert' : 'status'}
					className={datasetQuery.isError ? 'body-sm text-data-down' : undefined}
					style={{ height: MAP_HEIGHT }}
				>
					{datasetQuery.isError ? 'Chart unavailable' : <LoadingSpinner size={24} />}
				</ChartPanelBodyFallback>
			) : !hasRows ? (
				<ChartPanelBodyFallback className="body-sm text-tertiary" style={{ height: MAP_HEIGHT }}>
					No tokens match the current filters
				</ChartPanelBodyFallback>
			) : treemap ? (
				<>
					<React.Suspense fallback={<div style={{ height: MAP_HEIGHT }} />}>
						<MarketTreemapChart
							treeData={treemap.treeData}
							leaves={treemap.leaves}
							sizeLabel="MCap"
							colorLabel={`Price ${colorBy.toUpperCase()}`}
							valueSymbol="$"
							height={MAP_HEIGHT}
							showMarketCapRow={false}
							groupItemsLabel="Tokens"
							onReady={handleChartReady}
						/>
					</React.Suspense>
					<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pb-2 body-sm text-tertiary">
						{treemap.stablecoinsHidden > 0 ? <p>{treemap.stablecoinsHidden} stablecoins hidden</p> : null}
						<div
							className="ml-auto w-40 shrink-0 text-xs"
							role="img"
							aria-label={`Treemap color scale: loss through zero to gain for price ${colorBy}`}
						>
							<div
								className="h-1.5 rounded-full border border-subtle"
								style={{
									background: `linear-gradient(to right, ${EQUITIES_TREEMAP_COLORS.negative}, ${EQUITIES_TREEMAP_COLORS.neutral}, ${EQUITIES_TREEMAP_COLORS.positive})`
								}}
							/>
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
						title="Top Gainers"
						titleClassName="text-data-up"
						entries={movers.gainers}
						color={GAINER_COLOR}
					/>
					<MoversChart
						title="Top Losers"
						titleClassName="text-data-down"
						className="border-t border-subtle lg:border-t-0 lg:border-l"
						entries={movers.losers}
						color={LOSER_COLOR}
					/>
				</div>
			) : null}
		</>
	)
}

function MoversChart({
	title,
	titleClassName,
	className,
	entries,
	color
}: {
	title: string
	titleClassName: string
	className?: string
	entries: Array<TokensMoverEntry>
	color: string
}) {
	// Read by the chart's click handler, which echarts calls on user interaction, never during render.
	const entriesRef = React.useRef(entries)
	React.useLayoutEffect(() => {
		entriesRef.current = entries
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

	const handleReady = React.useCallback((instance: echarts.ECharts | null) => {
		if (!instance) return
		instance.off('click')
		instance.on('click', (params) => {
			const href = entriesRef.current[params.dataIndex]?.href
			if (href) void Router.push(href)
		})
	}, [])

	return (
		<div className={`flex min-w-0 flex-col ${className ?? ''}`.trim()}>
			<h3 className={`px-3 pt-2 label-md ${titleClassName}`}>{title}</h3>
			{entries.length === 0 ? (
				<div className="flex items-center justify-center body-sm text-tertiary" style={{ height: MOVERS_HEIGHT }}>
					Nothing to show
				</div>
			) : (
				<React.Suspense fallback={<div style={{ height: MOVERS_HEIGHT }} />}>
					<HBarChart
						categories={chartData.categories}
						values={chartData.values}
						color={color}
						logos={chartData.logos}
						valueSymbol="%"
						height={MOVERS_HEIGHT}
						onReady={handleReady}
					/>
				</React.Suspense>
			)}
		</div>
	)
}
