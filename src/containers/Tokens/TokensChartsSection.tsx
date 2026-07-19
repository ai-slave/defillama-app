import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import { EQUITIES_TREEMAP_COLORS } from '~/components/ECharts/EquitiesTreemapChart/colors'
import type { IHBarChartProps } from '~/components/ECharts/types'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { buttonStyles } from '~/ui/Button'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { pushShallowQuery } from '~/utils/routerQuery'
import { buildTokensMovers, buildTokensTreemap, prepareTokensTreemapCsv, type TokensMoverEntry } from './chartData'
import {
	getTokensChartQueryValue,
	parseTokensChartState,
	TOKENS_CHANGE_WINDOWS,
	TOKENS_MOVERS_WINDOWS,
	TOKENS_UNIVERSES,
	TOKENS_UNIVERSE_SIZE,
	type TokensChangeWindow,
	type TokensChartView,
	type TokensMapMode,
	type TokensMoversWindow,
	type TokensUniverse
} from './chartState'
import type { TokensChartDataset } from './types'

const EquitiesTreemapChart = React.lazy(() => import('~/components/ECharts/EquitiesTreemapChart'))
const HBarChart = React.lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>

const MAP_HEIGHT = '600px'
const MOVERS_HEIGHT = '360px'
const GAINER_COLOR = '#269f3c'
const LOSER_COLOR = '#942e38'
const EXPORT_FILENAME = 'tokens-market-map'
const CHART_ACTION_BUTTON_CLASSNAME = buttonStyles({ size: 'sm' })

const VIEW_OPTIONS: Array<{ value: TokensChartView; label: string }> = [
	{ value: 'map', label: 'Market Map' },
	{ value: 'movers', label: 'Movers' }
]

const UNIVERSE_OPTIONS = TOKENS_UNIVERSES.map((universe) => ({ value: universe, label: `Top ${universe}` }))

const CHANGE_WINDOW_OPTIONS = TOKENS_CHANGE_WINDOWS.map((window) => ({ value: window, label: window.toUpperCase() }))

const MOVERS_WINDOW_OPTIONS = TOKENS_MOVERS_WINDOWS.map((window) => ({ value: window, label: window.toUpperCase() }))

const MAP_MODE_OPTIONS: Array<{ value: TokensMapMode; label: string }> = [
	{ value: 'grouped', label: 'Group stables' },
	{ value: 'flat', label: 'Hide stables' }
]

export function TokensChartsSection({ data }: { data: TokensChartDataset }) {
	const router = useRouter()
	const chartState = parseTokensChartState(router.query)
	const { view, universe, colorBy, mapMode, moversWindow } = chartState
	const { chartInstance, handleChartReady } = useGetChartInstance()

	const setChartQuery = React.useCallback(
		(updates: Partial<typeof chartState>) => {
			const queryUpdates: Record<string, string | undefined> = {}
			for (const key in updates) {
				const stateKey = key as keyof typeof chartState
				const queryKey = stateKey === 'view' ? 'chartView' : stateKey === 'universe' ? 'chartTop' : stateKey
				queryUpdates[queryKey] = getTokensChartQueryValue(stateKey, updates[stateKey]!)
			}
			void pushShallowQuery(router, queryUpdates)
		},
		[router]
	)

	const universeSize = TOKENS_UNIVERSE_SIZE[universe]
	const treemap = React.useMemo(
		() => (view === 'map' ? buildTokensTreemap(data, { colorWindow: colorBy, mapMode, universe: universeSize }) : null),
		[colorBy, data, mapMode, universeSize, view]
	)
	const movers = React.useMemo(
		() => (view === 'movers' ? buildTokensMovers(data, { window: moversWindow, universe: universeSize }) : null),
		[data, moversWindow, universeSize, view]
	)

	return (
		<ChartPanel>
			<ChartPanelToolbar className="flex-wrap justify-end pb-2">
				<SegmentedControl
					value={view}
					onValueChange={(next: TokensChartView) => setChartQuery({ view: next })}
					options={VIEW_OPTIONS}
					label="Chart view"
					variant="default"
					size="md"
					className="mr-auto"
				/>
				<SegmentedControl
					value={universe}
					onValueChange={(next: TokensUniverse) => setChartQuery({ universe: next })}
					options={UNIVERSE_OPTIONS}
					label="Tokens by market cap"
					variant="default"
					size="sm"
				/>
				{view === 'map' && treemap ? (
					<>
						<SegmentedControl
							value={colorBy}
							onValueChange={(next: TokensChangeWindow) => setChartQuery({ colorBy: next })}
							options={CHANGE_WINDOW_OPTIONS}
							label="Price change window"
							variant="default"
							size="sm"
						/>
						<SegmentedControl
							value={mapMode}
							onValueChange={(next: TokensMapMode) => setChartQuery({ mapMode: next })}
							options={MAP_MODE_OPTIONS}
							label="Stablecoins display"
							variant="default"
							size="sm"
						/>
						{treemap.treeData.length > 0 ? (
							<>
								<ChartRestoreButton chartInstance={chartInstance} className={CHART_ACTION_BUTTON_CLASSNAME} />
								<ChartExportButtons
									chartInstance={chartInstance}
									className={CHART_ACTION_BUTTON_CLASSNAME}
									filename={EXPORT_FILENAME}
									title="Tokens Market Map"
									prepareCsvDirect={() =>
										prepareTokensTreemapCsv({ leaves: treemap.leaves, colorWindow: colorBy, filename: EXPORT_FILENAME })
									}
									pngProfile="treemapNormalized"
									smol
								/>
							</>
						) : null}
					</>
				) : (
					<SegmentedControl
						value={moversWindow}
						onValueChange={(next: TokensMoversWindow) => setChartQuery({ moversWindow: next })}
						options={MOVERS_WINDOW_OPTIONS}
						label="Price change window"
						variant="default"
						size="sm"
					/>
				)}
			</ChartPanelToolbar>
			{data.marketCaps.length === 0 ? (
				<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
					Chart unavailable
				</ChartPanelBodyFallback>
			) : view === 'map' && treemap ? (
				<>
					<React.Suspense fallback={<div style={{ height: MAP_HEIGHT }} />}>
						<EquitiesTreemapChart
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
		</ChartPanel>
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
	entries: TokensMoverEntry[]
	color: string
}) {
	const router = useRouter()
	const entriesRef = React.useRef(entries)
	entriesRef.current = entries
	const chartData = React.useMemo(() => {
		const categories: string[] = []
		const values: number[] = []
		const logos: string[] = []
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
			instance.on('click', (params) => {
				const href = entriesRef.current[params.dataIndex]?.href
				if (href) void router.push(href)
			})
		},
		[router]
	)

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
