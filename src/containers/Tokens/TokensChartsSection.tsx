import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type { IHBarChartProps } from '~/components/ECharts/types'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { pushShallowQuery } from '~/utils/routerQuery'
import { buildTokensMovers, buildTokensTreemap, type TokensMoverEntry } from './chartData'
import {
	getTokensChartQueryValue,
	parseTokensChartState,
	TOKENS_CHANGE_WINDOWS,
	TOKENS_MOVERS_WINDOWS,
	TOKENS_UNIVERSES,
	type TokensChangeWindow,
	type TokensChartView,
	type TokensMapMode,
	type TokensMoversWindow,
	type TokensUniverse
} from './chartState'
import { useTokensChartData } from './queries.client'
import { TOKENS_PAGE_RESPONSE_SCHEMA_VERSION, type TokensTableRow } from './types'

const EquitiesTreemapChart = React.lazy(() => import('~/components/ECharts/EquitiesTreemapChart'))
const HBarChart = React.lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>

const MAP_HEIGHT = '600px'
const MOVERS_HEIGHT = '568px'
const GAINER_COLOR = '#269f3c'
const LOSER_COLOR = '#942e38'

const VIEW_OPTIONS: Array<{ value: TokensChartView; label: string }> = [
	{ value: 'map', label: 'Market Map' },
	{ value: 'movers', label: 'Gainers & Losers' }
]

const UNIVERSE_OPTIONS = TOKENS_UNIVERSES.map((universe) => ({ value: universe, label: `Top ${universe}` }))

const CHANGE_WINDOW_OPTIONS = TOKENS_CHANGE_WINDOWS.map((window) => ({ value: window, label: window.toUpperCase() }))

const MOVERS_WINDOW_OPTIONS = TOKENS_MOVERS_WINDOWS.map((window) => ({ value: window, label: window.toUpperCase() }))

const MAP_MODE_OPTIONS: Array<{ value: TokensMapMode; label: string }> = [
	{ value: 'grouped', label: 'Stables' },
	{ value: 'flat', label: 'No Stables' }
]

export function TokensChartsSection() {
	const router = useRouter()
	const chartState = parseTokensChartState(router.query)
	const { view, universe, colorBy, mapMode, moversWindow } = chartState
	const { chartInstance, handleChartReady } = useGetChartInstance()

	const chartQuery = useTokensChartData()
	const rows = React.useMemo<TokensTableRow[]>(
		() => (chartQuery.data?.schemaVersion === TOKENS_PAGE_RESPONSE_SCHEMA_VERSION ? chartQuery.data.rows : []),
		[chartQuery.data]
	)

	const setChartQuery = React.useCallback(
		(updates: Partial<typeof chartState>) => {
			handleChartReady(null)
			const queryUpdates: Record<string, string | undefined> = {}
			for (const key in updates) {
				const stateKey = key as keyof typeof chartState
				const queryKey = stateKey === 'view' ? 'chartView' : stateKey === 'universe' ? 'chartTop' : stateKey
				queryUpdates[queryKey] = getTokensChartQueryValue(stateKey, updates[stateKey]!)
			}
			void pushShallowQuery(router, queryUpdates)
		},
		[handleChartReady, router]
	)

	const universeCount = Number(universe)
	const treemap = React.useMemo(
		() => buildTokensTreemap(rows, { colorWindow: colorBy, mapMode, universe: universeCount }),
		[colorBy, mapMode, rows, universeCount]
	)
	const movers = React.useMemo(
		() => buildTokensMovers(rows, { window: moversWindow, universe: universeCount }),
		[moversWindow, rows, universeCount]
	)

	const isLoading = chartQuery.isLoading
	const isError = !isLoading && (chartQuery.error != null || rows.length === 0)

	return (
		<ChartPanel>
			<ChartPanelToolbar className="flex-wrap justify-end">
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
				{view === 'map' ? (
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
						<ChartExportButtons chartInstance={chartInstance} filename="tokens-market-map" title="Tokens Market Map" />
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
			{isLoading ? (
				<ChartPanelBodyFallback role="status" aria-live="polite" className="body-sm text-tertiary">
					Loading chart...
				</ChartPanelBodyFallback>
			) : isError ? (
				<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
					Chart unavailable
				</ChartPanelBodyFallback>
			) : view === 'map' ? (
				<>
					<React.Suspense fallback={<div style={{ height: MAP_HEIGHT }} />}>
						<EquitiesTreemapChart
							treeData={treemap.treeData}
							sizeLabel="MCap"
							colorLabel={`Price ${colorBy}`}
							valueSymbol="$"
							height={MAP_HEIGHT}
							showMarketCapRow={false}
							groupItemsLabel="Tokens"
							onReady={handleChartReady}
						/>
					</React.Suspense>
					{treemap.excludedCount > 0 || treemap.stablecoinsHidden > 0 ? (
						<p className="px-3 pb-2 body-sm text-tertiary">
							{[
								treemap.excludedCount > 0 ? `${treemap.excludedCount} tokens hidden (missing MCap)` : '',
								treemap.stablecoinsHidden > 0 ? `${treemap.stablecoinsHidden} stablecoins hidden` : ''
							]
								.filter(Boolean)
								.join(' · ')}
						</p>
					) : null}
				</>
			) : (
				<div className="grid grid-cols-1 lg:grid-cols-2">
					<MoversChart
						title="Top Gainers"
						titleClassName="text-data-up"
						entries={movers.gainers}
						color={GAINER_COLOR}
					/>
					<MoversChart title="Top Losers" titleClassName="text-data-down" entries={movers.losers} color={LOSER_COLOR} />
				</div>
			)}
		</ChartPanel>
	)
}

function MoversChart({
	title,
	titleClassName,
	entries,
	color
}: {
	title: string
	titleClassName: string
	entries: TokensMoverEntry[]
	color: string
}) {
	const router = useRouter()
	const hrefsRef = React.useRef<Array<string | null>>([])
	hrefsRef.current = entries.map((entry) => entry.href)

	const handleReady = React.useCallback(
		(instance: echarts.ECharts | null) => {
			if (!instance) return
			instance.off('click')
			instance.on('click', (params) => {
				const href = hrefsRef.current[params.dataIndex]
				if (href) void router.push(href)
			})
		},
		[router]
	)

	return (
		<div className="flex min-w-0 flex-col">
			<h3 className={`px-3 pt-2 label-md ${titleClassName}`}>{title}</h3>
			{entries.length === 0 ? (
				<div className="flex items-center justify-center body-sm text-tertiary" style={{ height: MOVERS_HEIGHT }}>
					Nothing to show
				</div>
			) : (
				<React.Suspense fallback={<div style={{ height: MOVERS_HEIGHT }} />}>
					<HBarChart
						categories={entries.map((entry) => entry.name)}
						values={entries.map((entry) => entry.value)}
						colors={entries.map(() => color)}
						logos={entries.map((entry) => entry.logo)}
						valueSymbol="%"
						height={MOVERS_HEIGHT}
						onReady={handleReady}
					/>
				</React.Suspense>
			)}
		</div>
	)
}
