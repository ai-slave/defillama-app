import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { buildSelectedPercentageChart } from '~/components/ECharts/MultiSeriesChart/selection'
import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import {
	buildRuntimePieChartCsvDataset,
	buildRuntimePieChartPresentation,
	prepareRuntimePieChartData
} from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { EntityQuestionsStrip } from '~/components/EntityQuestionsStrip'
import { inRange, rangeQuickPicks, USD_QUICK_PICK_LADDER } from '~/components/Filters/quickPicks'
import { NewsletterSignup } from '~/components/Newsletter/NewsletterSignup'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { CHART_SERIES_LIMIT, chartColor } from '~/constants/colors'
import {
	CHAINS_CATEGORY_GROUP_SETTINGS,
	TVL_SETTINGS_KEYS,
	useLocalStorageSettingsManager,
	type TvlSettingsKey
} from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import {
	ChartPanel,
	ChartPanelBodyError,
	ChartPanelBodyFallback,
	ChartPanelExportShellFallback,
	ChartPanelToolbar
} from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { ScopeNote, ignoredFiltersPhrase } from '~/ui/ScopeNote'
import { LoadingIndicator } from '~/ui/Status'
import { getPercentChange } from '~/utils'
import { fetchJson } from '~/utils/async'
import { queryReadFailed } from '~/utils/query'
import { aggregateGroupedChainRows, getTopLevelGroupedChains } from './grouping'
import { ChainsByCategoryTable } from './Table'
import { applyChainsTvlSettings, getChainMcapTvlRatio } from './tvl'
import type { IChain, IChainsByCategoryData, IFormattedDataWithExtraTvl } from './types'

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))
type ChainsChartData = Pick<IChainsByCategoryData, 'tvlChartsByChain' | 'totalTvlByDate'>
const EMPTY_CHAINS_CHART_DATA: ChainsChartData = { tvlChartsByChain: { tvl: {} }, totalTvlByDate: { tvl: {} } }
const CHAIN_TVL_VALUE_KEYS = [...TVL_SETTINGS_KEYS, 'dcAndLsOverlap'] as const

const getChartExtraValues = ({
	tvlChartsByChain,
	chain,
	date
}: {
	tvlChartsByChain: IChainsByCategoryData['tvlChartsByChain']
	chain: string
	date: number
}) => {
	const values: Partial<Record<TvlSettingsKey | 'dcAndLsOverlap', number | null>> = {}
	for (const key of CHAIN_TVL_VALUE_KEYS) {
		const chart = tvlChartsByChain[key]?.[chain]
		if (!chart) continue
		values[key] = chart[date] ?? null
	}
	return values
}

const getChainRowExtraValues = ({
	chain,
	metric
}: {
	chain: IChain
	metric: 'tvl' | 'tvlPrevDay' | 'tvlPrevWeek' | 'tvlPrevMonth'
}) => {
	const values: Partial<Record<TvlSettingsKey | 'dcAndLsOverlap', number | null>> = {}
	for (const key of CHAIN_TVL_VALUE_KEYS) {
		if (!Object.hasOwn(chain.extraTvl, key)) continue
		values[key] = chain.extraTvl[key]?.[metric] ?? null
	}
	return values
}

export function ChainsByCategory({
	chains,
	allCategories,
	category: _category,
	categoryName,
	tvlChartsByChain,
	totalTvlByDate,
	entityQuestions
}: IChainsByCategoryData & { entityQuestions?: Array<string> }) {
	const [tvlSettings] = useLocalStorageSettingsManager('tvl')
	const enabledTvlSettings = React.useMemo(() => TVL_SETTINGS_KEYS.filter((key) => tvlSettings[key]), [tvlSettings])
	const enabledTvlSettingsKey = enabledTvlSettings.join(',')
	const shouldFetchChartData = tvlChartsByChain.tvl == null
	const chartDataQuery = useQuery({
		queryKey: ['page-data', 'chains', 'charts', _category, enabledTvlSettingsKey],
		queryFn: () => {
			const searchParams = new URLSearchParams({
				category: _category,
				sampledChart: _category.toLowerCase() === 'all' ? 'true' : 'false'
			})
			if (enabledTvlSettingsKey) {
				searchParams.set('extraTvlTypes', enabledTvlSettingsKey)
			}
			return fetchJson<ChainsChartData>(`/api/public/page-data/chains/charts?${searchParams.toString()}`)
		},
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: shouldFetchChartData
	})
	const chartData =
		chartDataQuery.data ?? (shouldFetchChartData ? EMPTY_CHAINS_CHART_DATA : { tvlChartsByChain, totalTvlByDate })
	const { pieSeries, dominanceCharts, chainSeries, colorsByChain } = useFormatChartData({
		tvlChartsByChain: chartData.tvlChartsByChain,
		totalTvlByDate: chartData.totalTvlByDate,
		enabledTvlSettings
	})
	const chartReadFailed = queryReadFailed(chartDataQuery)
	const showSharedChartState = chartReadFailed || (shouldFetchChartData && chartDataQuery.isLoading)
	const pieSelectableSeries = React.useMemo(() => pieSeries.peers.map((peer) => peer.name), [pieSeries.peers])
	// The dominance chart starts on the ten largest chains and folds the rest into Others: drawing all ~500 chains as
	// their own bands cost about a second of main-thread time on every load. Picking chains still draws exactly those.
	const defaultDominanceSeries = React.useMemo(() => chainSeries.slice(0, CHART_SERIES_LIMIT), [chainSeries])
	const { activeSeries, selectedCharts, setSelectedSeries } = useLocalSelection({
		availableSeries: chainSeries,
		defaultSeries: defaultDominanceSeries,
		scope: categoryName
	})
	const selectedDominance = React.useMemo(
		() =>
			buildSelectedPercentageChart({
				dataset: dominanceCharts.dataset,
				charts: dominanceCharts.charts,
				selectedCharts,
				missingValuePolicy: 'sum-available'
			}),
		[dominanceCharts, selectedCharts]
	)
	const {
		activeSeries: activePieSeries,
		selectedCharts: selectedPieSeries,
		setSelectedSeries: setSelectedPieSeries
	} = useLocalSelection({ allowEmptySelection: true, availableSeries: pieSelectableSeries, scope: categoryName })
	const piePresentation = React.useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: pieSeries,
				selectedSeries: selectedPieSeries,
				colorByPeer: colorsByChain
			}),
		[colorsByChain, pieSeries, selectedPieSeries]
	)
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const { chartInstance: pieChartInstance, handleChartReady: handlePieChartReady } = useGetChartInstance()
	const { showByGroup, chainsTableData, chartIgnoredFilters, tvlQuickPicks } = useGroupAndFormatChains({
		chains,
		category: categoryName
	})
	const chartScopeNote =
		chartIgnoredFilters.length > 0 ? (
			<ScopeNote>This chart ignores {ignoredFiltersPhrase(chartIgnoredFilters)} and shows every chain.</ScopeNote>
		) : null

	return (
		<>
			<RowLinksWithDropdown heading="Categories" links={allCategories} activeLink={categoryName} />
			{entityQuestions && entityQuestions.length > 0 ? (
				<EntityQuestionsStrip questions={entityQuestions} entitySlug="chains" entityType="page" entityName="Chains" />
			) : null}

			{showSharedChartState ? (
				<div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
					<ChartPanel className="relative isolate col-span-full">
						{chartReadFailed ? (
							<ChartPanelBodyError retry={chartDataQuery}>Failed to load chart data.</ChartPanelBodyError>
						) : (
							<ChartPanelExportShellFallback
								role="status"
								aria-live="polite"
								className="flex items-center justify-center text-center body-sm text-tertiary"
							>
								<LoadingIndicator />
								<span className="sr-only">Loading chart data</span>
							</ChartPanelExportShellFallback>
						)}
					</ChartPanel>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
					<ChartPanel className="relative isolate">
						<ChartPanelToolbar>
							{pieSelectableSeries.length > 1 ? (
								<SelectWithCombobox
									allValues={pieSelectableSeries}
									selectedValues={activePieSeries}
									setSelectedValues={setSelectedPieSeries}
									label="Chain"
									labelType="smol"
									variant="filter"
									size="md"
								/>
							) : null}
							<ChartExportButtons
								chartInstance={pieChartInstance}
								filename="chains-tvl-pie"
								title="Chains TVL"
								csvSource={{
									type: 'dataset',
									prepare: () =>
										buildRuntimePieChartCsvDataset({
											series: pieSeries,
											selectedSeries: selectedPieSeries
										})
								}}
							/>
						</ChartPanelToolbar>
						{chartScopeNote}
						<React.Suspense fallback={<ChartPanelBodyFallback />}>
							<PieChart
								chartData={piePresentation.chartData}
								stackColors={piePresentation.stackColors}
								onReady={handlePieChartReady}
							/>
						</React.Suspense>
					</ChartPanel>
					<ChartPanel className="relative isolate">
						<ChartPanelToolbar>
							{chainSeries.length > 1 ? (
								<SelectWithCombobox
									allValues={chainSeries}
									selectedValues={activeSeries}
									setSelectedValues={setSelectedSeries}
									label="Chain"
									labelType="smol"
									variant="filter"
									size="md"
								/>
							) : null}
							<ChartExportButtons
								chartInstance={chartInstance}
								filename="chains-dominance"
								title="Chains Dominance"
								csvSource={selectedDominance.csvSource}
							/>
						</ChartPanelToolbar>
						{chartScopeNote}
						<React.Suspense fallback={<ChartPanelBodyFallback />}>
							<MultiSeriesChart
								dataset={selectedDominance.dataset}
								charts={selectedDominance.charts}
								csvSource={selectedDominance.csvSource}
								valueSymbol="%"
								expandTo100Percent
								solidChartAreaStyle
								onReady={handleChartReady}
							/>
						</React.Suspense>
					</ChartPanel>
				</div>
			)}

			<NewsletterSignup layout="strip" />

			<React.Suspense
				fallback={<Panel padding="none" style={{ minHeight: `${chainsTableData.length * 50 + 200}px` }} />}
			>
				<ChainsByCategoryTable data={chainsTableData} showByGroup={showByGroup} tvlQuickPicks={tvlQuickPicks} />
			</React.Suspense>
		</>
	)
}

export const buildChainsByCategoryChartPresentation = ({
	tvlChartsByChain,
	totalTvlByDate,
	enabledTvlSettings
}: {
	tvlChartsByChain: IChainsByCategoryData['tvlChartsByChain']
	totalTvlByDate: IChainsByCategoryData['totalTvlByDate']
	enabledTvlSettings: ReadonlyArray<TvlSettingsKey>
}) => {
	const recentTvlByChain: Record<string, number> = {}
	const tvlByChain = tvlChartsByChain['tvl'] ?? {}
	const chainNames: Array<string> = []
	for (const chain in tvlByChain) {
		chainNames.push(chain)
	}

	const source: Array<Array<number | null>> = []
	const totalTvlChart = totalTvlByDate.tvl
	let latestDateKey: string | null = null
	if (totalTvlChart) {
		for (const dateKey in totalTvlChart) latestDateKey = dateKey
	}
	let dateIndex = 0
	for (const dateKey in totalTvlChart ?? {}) {
		const date = Number(dateKey)
		const includeRow = dateIndex % 2 === 1
		dateIndex++
		const isLatest = dateKey === latestDateKey
		if (!includeRow && !isLatest) continue
		const row = includeRow ? new Array<number | null>(chainNames.length + 1) : null
		if (row) row[0] = date
		for (let chainIndex = 0; chainIndex < chainNames.length; chainIndex++) {
			// The index is bounded by chainNames.length; this loop can traverse millions of cells.
			const chain = chainNames[chainIndex]
			if (chain === undefined) throw new Error(`Missing chain chart dimension at index ${chainIndex}`)
			const value = applyChainsTvlSettings(
				tvlChartsByChain['tvl']?.[chain]?.[date],
				getChartExtraValues({ tvlChartsByChain, chain, date }),
				enabledTvlSettings
			)
			if (isLatest && value != null) recentTvlByChain[chain] = value
			if (row) row[chainIndex + 1] = value
		}
		if (row) source.push(row)
	}
	const dimensions = ['timestamp', ...chainNames]
	const pieSeries = prepareRuntimePieChartData({ data: recentTvlByChain, limit: CHART_SERIES_LIMIT })
	const chainSeries = pieSeries.peers.map((peer) => peer.name)
	const rankedCurrentChains = new Set(chainSeries)
	for (const chain of chainNames) {
		if (!rankedCurrentChains.has(chain)) chainSeries.push(chain)
	}
	const dimensionIndex = new Map(chainNames.map((chain, index) => [chain, index + 1]))
	// Colours follow the rank both charts share, under the TVL settings in use, so the pie and the dominance chart
	// colour a chain alike. Past the top ten the dominance chart recolours its stack by overlap.
	const colorsByChain: Record<string, string> = {}
	const chartsConfig: Array<MultiSeriesChartSeriesConfig> = []
	for (const [rank, chain] of chainSeries.entries()) {
		const yDimension = dimensionIndex.get(chain)
		if (yDimension == null) throw new Error(`Missing chart dimension for chain ${chain}`)
		colorsByChain[chain] = chartColor(rank)
		chartsConfig.push({
			type: 'line',
			name: chain,
			encode: { x: 0, y: yDimension },
			stack: chain,
			color: colorsByChain[chain]
		})
	}
	return {
		dominanceCharts: { dataset: { source, dimensions }, charts: chartsConfig },
		pieSeries,
		chainSeries,
		colorsByChain
	}
}

const useFormatChartData = (options: Parameters<typeof buildChainsByCategoryChartPresentation>[0]) => {
	const { enabledTvlSettings, totalTvlByDate, tvlChartsByChain } = options
	return React.useMemo(
		() =>
			buildChainsByCategoryChartPresentation({
				enabledTvlSettings,
				totalTvlByDate,
				tvlChartsByChain
			}),
		[enabledTvlSettings, totalTvlByDate, tvlChartsByChain]
	)
}

/** The table filters the TVL pie and dominance charts cannot follow: they draw every chain in the category. */
export function getChainsChartIgnoredFilters(
	minTvl: number | null,
	maxTvl: number | null,
	groupedParents: Array<string>
): Array<string> {
	const labels: Array<string> = []
	if (minTvl != null || maxTvl != null) labels.push('TVL range')
	if (groupedParents.length > 0) labels.push('Group Chains')
	return labels
}

export const useGroupAndFormatChains = ({
	chains,
	category,
	hideGroupBy = false
}: {
	chains: IChainsByCategoryData['chains']
	category: string
	hideGroupBy?: boolean
}) => {
	const { query } = useRouter()

	const minMaxTvl = React.useMemo(() => {
		const { minTvl, maxTvl } = query
		return JSON.stringify({
			minTvl: typeof minTvl === 'string' && minTvl !== '' ? +minTvl : null,
			maxTvl: typeof maxTvl === 'string' && maxTvl !== '' ? +maxTvl : null
		})
	}, [query])

	const [tvlSettings] = useLocalStorageSettingsManager('tvl')
	const [chainsGroupbyParent] = useLocalStorageSettingsManager('tvl_chains')

	return React.useMemo(() => {
		const showByGroup = ['All', 'Non-EVM'].includes(category) && !hideGroupBy
		const toggledTvlSettings = TVL_SETTINGS_KEYS.filter((key) => tvlSettings[key])
		const toggledChainsGroupbyParent = CHAINS_CATEGORY_GROUP_SETTINGS.filter(
			(item) => chainsGroupbyParent[item.key]
		).map((item) => item.key)
		const { minTvl, maxTvl } = JSON.parse(minMaxTvl)
		const chartIgnoredFilters = getChainsChartIgnoredFilters(
			minTvl,
			maxTvl,
			showByGroup ? toggledChainsGroupbyParent : []
		)

		const allChains = chains.map((chain) => {
			const finalTvl = applyChainsTvlSettings(
				chain.tvl,
				getChainRowExtraValues({ chain, metric: 'tvl' }),
				toggledTvlSettings
			)
			const finalTvlPrevDay = applyChainsTvlSettings(
				chain.tvlPrevDay,
				getChainRowExtraValues({ chain, metric: 'tvlPrevDay' }),
				toggledTvlSettings
			)
			const finalTvlPrevWeek = applyChainsTvlSettings(
				chain.tvlPrevWeek,
				getChainRowExtraValues({ chain, metric: 'tvlPrevWeek' }),
				toggledTvlSettings
			)
			const finalTvlPrevMonth = applyChainsTvlSettings(
				chain.tvlPrevMonth,
				getChainRowExtraValues({ chain, metric: 'tvlPrevMonth' }),
				toggledTvlSettings
			)

			const change_1d = getPercentChange(finalTvl, finalTvlPrevDay)
			const change_7d = getPercentChange(finalTvl, finalTvlPrevWeek)
			const change_1m = getPercentChange(finalTvl, finalTvlPrevMonth)

			return {
				...chain,
				tvl: finalTvl,
				tvlPrevDay: finalTvlPrevDay,
				tvlPrevWeek: finalTvlPrevWeek,
				tvlPrevMonth: finalTvlPrevMonth,
				change_1d,
				change_7d,
				change_1m,
				mcaptvl: getChainMcapTvlRatio(chain.mcap, finalTvl)
			}
		})
		// Counted before the TVL range, so applying a chip leaves the other chips in place.
		const tvlQuickPicks = rangeQuickPicks(
			USD_QUICK_PICK_LADDER,
			allChains.map((chain) => chain.tvl)
		)
		const data = allChains.filter((chain) => inRange(chain.tvl, minTvl, maxTvl))

		if (!showByGroup) return { showByGroup, chainsTableData: data, chartIgnoredFilters, tvlQuickPicks }
		const chainsTableData: Array<IFormattedDataWithExtraTvl> = []
		for (const chain of getTopLevelGroupedChains(data, toggledChainsGroupbyParent)) {
			const subChainsList = new Set<string>()
			for (const group of toggledChainsGroupbyParent) {
				const childGroup = chain.childGroups?.[group]
				if (childGroup) {
					for (const subChain of childGroup) {
						subChainsList.add(subChain)
					}
				}
			}

			if (subChainsList.size === 0) {
				chainsTableData.push(chain)
				continue
			}

			const subChains = data.filter((childChain) => subChainsList.has(childChain.name))
			const subRows = [chain].concat(subChains)

			const totals = aggregateGroupedChainRows(subRows)
			const {
				tvl,
				tvlPrevDay,
				tvlPrevWeek,
				tvlPrevMonth,
				mcap,
				stablesMcap,
				activeUsers24h,
				activeUsers7d,
				activeUsers30d,
				dexVolume24h,
				dexVolume7d,
				dexVolume30d,
				fees24h,
				fees7d,
				fees30d,
				revenue24h,
				revenue7d,
				revenue30d,
				appRevenue24h,
				appRevenue7d,
				appRevenue30d,
				chainAssets,
				protocols
			} = totals

			const change_1d = getPercentChange(tvl, tvlPrevDay)
			const change_7d = getPercentChange(tvl, tvlPrevWeek)
			const change_1m = getPercentChange(tvl, tvlPrevMonth)
			const mcaptvl = getChainMcapTvlRatio(mcap, tvl)

			chainsTableData.push({
				...chain,
				tvl,
				tvlPrevDay,
				tvlPrevWeek,
				tvlPrevMonth,
				mcap,
				change_1d,
				change_7d,
				change_1m,
				mcaptvl,
				protocols,
				activeUsers24h,
				activeUsers7d,
				activeUsers30d,
				dexVolume24h,
				dexVolume7d,
				dexVolume30d,
				fees24h,
				fees7d,
				fees30d,
				revenue24h,
				revenue7d,
				revenue30d,
				appRevenue24h,
				appRevenue7d,
				appRevenue30d,
				chainAssets,
				stablesMcap,
				subRows
			})
		}

		return {
			showByGroup,
			chartIgnoredFilters,
			tvlQuickPicks,
			chainsTableData: chainsTableData.sort((a, b) => {
				if (a.tvl == null) return b.tvl == null ? 0 : 1
				if (b.tvl == null) return -1
				return b.tvl - a.tvl
			})
		}
	}, [category, chains, tvlSettings, minMaxTvl, chainsGroupbyParent, hideGroupBy])
}
