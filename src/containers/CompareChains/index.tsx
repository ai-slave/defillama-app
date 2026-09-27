import { useQueries } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import type { NextRouter } from 'next/router'
import * as React from 'react'
import type {
	IMultiSeriesChartProps,
	MultiSeriesChartSeriesConfig,
	MultiSeriesTimeSeriesDataset,
	MultiSeriesTimeSeriesRow
} from '~/components/ECharts/MultiSeriesChart/types'
import { MultiSelectCombobox } from '~/components/Select/MultiSelectCombobox'
import { Select } from '~/components/Select/Select'
import { selectTriggerStyles } from '~/components/Select/types'
import type { IAdapterChainOverview, IAdapterProtocolOverview } from '~/containers/AdapterMetrics/types'
import { Stats } from '~/containers/ChainOverview/Stats'
import type { IChainOverviewData } from '~/containers/ChainOverview/types'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { ChartPanel, ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { FailedDataNote } from '~/ui/ScopeNote'
import { LoadingIndicator, PanelStatus } from '~/ui/Status'
import { getNDistinctColors } from '~/utils'
import { fetchJson } from '~/utils/async'
import {
	buildCompareChainAdapterQueryKey,
	buildCompareChainOverviewQueryKey,
	getCompareChainFailedSources,
	getCompareChainAdapterMetrics,
	hasPendingCompareChainSources,
	fetchCompareChainAdapterMetric,
	mergeCompareChainSources
} from './requestPlan'
import { buildCompareChainsTvlChartState, type CompareChainsTvlChartState } from './tvlChart'

const MultiSeriesChart = React.lazy(
	() => import('~/components/ECharts/MultiSeriesChart')
) as React.FC<IMultiSeriesChartProps>

interface ChainOption {
	value: string
	label: string
	logo: string
}

interface SupportedChart {
	id: string
	name: string
	key: 'tvlChart' | 'dexVolumeChart' | 'chainFeesChart' | 'chainRevenueChart'
	type: 'line' | 'bar'
	timestampUnit: 'milliseconds' | 'seconds'
}

// Supported charts configuration
const supportedCharts: Array<SupportedChart> = [
	{ id: 'tvl', name: 'TVL', key: 'tvlChart', type: 'line', timestampUnit: 'milliseconds' },
	{ id: 'volume', name: 'DEXs Volume', key: 'dexVolumeChart', type: 'bar', timestampUnit: 'seconds' },
	{ id: 'chainFees', name: 'Chain Fees', key: 'chainFeesChart', type: 'bar', timestampUnit: 'seconds' },
	{ id: 'chainRevenue', name: 'Chain Revenue', key: 'chainRevenueChart', type: 'bar', timestampUnit: 'seconds' }
]

type ChainDataResult = {
	chainFeesChart: IAdapterProtocolOverview['totalDataChart'] | null
	chainRevenueChart: IAdapterProtocolOverview['totalDataChart'] | null
	dexVolumeChart: IAdapterChainOverview['totalDataChart'] | null
	chain: string
	chainOverviewData: IChainOverviewData
}

type CompareResult = {
	data: Array<ChainDataResult | null>
	isLoading: boolean
	failedChains: Array<string>
}

const getChainData = async (chain: string): Promise<ChainDataResult> => {
	const chainData = await fetchJson<{
		chainOverviewData: IChainOverviewData
	}>(`/api/dynamic/cache/chain/${encodeURIComponent(chain)}`)

	return {
		chainFeesChart: null,
		chainRevenueChart: null,
		dexVolumeChart: null,
		chain,
		chainOverviewData: chainData.chainOverviewData
	}
}

const useCompare = ({
	chains = [],
	selectedCharts
}: {
	chains?: Array<string>
	selectedCharts: ReadonlyArray<string>
}) => {
	const adapterMetrics = React.useMemo(() => getCompareChainAdapterMetrics(selectedCharts), [selectedCharts])
	const overviewQueries = React.useMemo(
		() =>
			chains.map((chain) => ({
				queryKey: buildCompareChainOverviewQueryKey(chain),
				queryFn: () => getChainData(chain),
				staleTime: 60 * 60 * 1000,
				refetchOnWindowFocus: false,
				retry: 0
			})),
		[chains]
	)
	const metricQueries = React.useMemo(
		() =>
			chains.flatMap((chain) =>
				adapterMetrics.map((metric) => ({
					queryKey: buildCompareChainAdapterQueryKey(chain, metric),
					queryFn: () => fetchCompareChainAdapterMetric(chain, metric),
					staleTime: 60 * 60 * 1000,
					refetchOnWindowFocus: false,
					retry: 0
				}))
			),
		[chains, adapterMetrics]
	)
	const overviewResults = useQueries({ queries: overviewQueries })
	const metricResults = useQueries({ queries: metricQueries })

	return React.useMemo<CompareResult>(() => {
		const failedChains = getCompareChainFailedSources({
			chains,
			adapterMetrics,
			overviewErrors: overviewResults.map((result) => result.error),
			metricErrors: metricResults.map((result) => result.error),
			metricLabels: {
				dexVolumeChart: 'DEXs Volume',
				chainFeesChart: 'Chain Fees',
				chainRevenueChart: 'Chain Revenue'
			}
		})
		const data = overviewResults.map((overviewResult, chainIndex) => {
			return mergeCompareChainSources({
				overview: overviewResult.data,
				adapterMetrics,
				metricData: adapterMetrics.map(
					(_, metricIndex) => metricResults[chainIndex * adapterMetrics.length + metricIndex]?.data
				)
			})
		})

		return {
			data,
			isLoading: hasPendingCompareChainSources(overviewResults, metricResults),
			failedChains
		}
	}, [adapterMetrics, chains, metricResults, overviewResults])
}

// Build chart lookup map for O(1) access
const chartsMap: ReadonlyMap<string, SupportedChart> = new Map(supportedCharts.map((chart) => [chart.key, chart]))

type CompareChainChartData = Pick<
	ChainDataResult,
	'chain' | 'dexVolumeChart' | 'chainFeesChart' | 'chainRevenueChart'
> & { tvlChart: Array<[number, number]> | null }

export const buildCompareChainsChartData = (
	chainsData: Array<CompareChainChartData>,
	selectedCharts: Array<string>
): {
	dataset: MultiSeriesTimeSeriesDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	showTotalInTooltip: boolean
} => {
	if (chainsData.length === 0) {
		return { dataset: { source: [], dimensions: ['timestamp'] }, charts: [], showTotalInTooltip: false }
	}

	const colors = getNDistinctColors(selectedCharts.length * chainsData.length)
	let colorIndex = 0
	const seriesNames: Array<string> = []
	const seriesConfigs: Array<MultiSeriesChartSeriesConfig> = []
	const seriesData: Array<{ entries: Array<[number, number]>; dateInMs: boolean; dimensionIndex: number }> = []
	const displayedMetricKinds = new Set<SupportedChart['key']>()

	for (const chart of selectedCharts) {
		const targetChart = chartsMap.get(chart)
		if (!targetChart) continue
		displayedMetricKinds.add(targetChart.key)

		const dateInMs = targetChart.timestampUnit === 'milliseconds'

		for (const chainData of chainsData) {
			const name = `${chainData.chain} - ${targetChart.name}`
			seriesNames.push(name)
			const dimensionIndex = seriesNames.length
			const color = colors[colorIndex]
			if (color == null) throw new Error(`Missing comparison chart color at index ${colorIndex}`)
			seriesConfigs.push({
				type: targetChart.type,
				name,
				encode: { x: 0, y: dimensionIndex },
				stack: name,
				color
			})
			colorIndex++

			const chartEntries = chainData[targetChart.key]
			seriesData.push({ entries: chartEntries ?? [], dateInMs, dimensionIndex })
		}
	}

	const rowMap = new Map<number, MultiSeriesTimeSeriesRow>()
	for (const { entries, dateInMs, dimensionIndex } of seriesData) {
		for (const [timestamp, value] of entries) {
			const ts = dateInMs ? timestamp : timestamp * 1e3
			let row = rowMap.get(ts)
			if (!row) {
				row = [ts, ...new Array<number | null>(seriesNames.length).fill(null)]
				rowMap.set(ts, row)
			}
			row[dimensionIndex] = value
		}
	}

	const source = Array.from(rowMap.values()).sort((a, b) => a[0] - b[0])
	return {
		dataset: { source, dimensions: ['timestamp', ...seriesNames] },
		charts: seriesConfigs,
		showTotalInTooltip: displayedMetricKinds.size === 1 && seriesConfigs.length > 0
	}
}

export function buildCompareChainsTvlCharts(
	data: Array<{
		chain: string
		chainOverviewData: Pick<IChainOverviewData, 'tvlChart' | 'extraTvlCharts'>
	}>,
	tvlSettings: Record<string, boolean>
): Record<string, CompareChainsTvlChartState> {
	const charts: Record<string, CompareChainsTvlChartState> = {}
	for (const chainData of data) {
		if (chainData.chainOverviewData.tvlChart.length === 0) continue
		charts[chainData.chain] = buildCompareChainsTvlChartState({
			tvlChart: chainData.chainOverviewData.tvlChart,
			tvlSettings,
			extraTvlCharts: chainData.chainOverviewData.extraTvlCharts
		})
	}
	return charts
}

const updateRoute = (key: string, val: string | Array<string>, router: NextRouter) => {
	void router.push(
		{
			query: {
				...router.query,
				[key]: val
			}
		},
		undefined,
		{ shallow: true }
	)
}

function ChartFilters() {
	const { selectedValues, setSelectedValues } = useChainsChartFilterState()

	const selectedChartsNames = React.useMemo(() => {
		return selectedValues.map((value) => chartsMap.get(value)?.name ?? '')
	}, [selectedValues])

	return (
		<Select
			allValues={supportedCharts}
			selectedValues={selectedValues}
			setSelectedValues={setSelectedValues}
			labelType="none"
			variant="default"
			size="md"
			label={
				<>
					<span>Charts: </span>
					<span className="text-link">
						{selectedChartsNames.length > 2
							? `${selectedChartsNames[0]} + ${selectedChartsNames.length - 1} others`
							: selectedChartsNames.join(', ')}
					</span>
				</>
			}
			triggerProps={{
				className: selectTriggerStyles('default', 'md')
			}}
			placement="bottom-end"
		/>
	)
}

export function CompareChains({ chains }: { chains: Array<ChainOption> }) {
	const [tvlSettings] = useLocalStorageSettingsManager('tvl')
	const { selectedValues: selectedChartFilters } = useChainsChartFilterState()

	const router = useRouter()
	const chainsQuery = router.query?.chains

	const selectedChains = React.useMemo(() => {
		return [chainsQuery]
			.flat()
			.filter((c): c is string => typeof c === 'string')
			.map((chain) => ({ value: chain, label: chain }))
	}, [chainsQuery])

	const selectedChainValues = React.useMemo(() => selectedChains.map((chain) => chain.value), [selectedChains])

	const { data, isLoading, failedChains } = useCompare({
		chains: selectedChainValues,
		selectedCharts: selectedChartFilters
	})

	const isChartLoading = isLoading

	const tvlCharts = React.useMemo(() => {
		return buildCompareChainsTvlCharts(
			data.filter((chainData): chainData is ChainDataResult => chainData != null),
			tvlSettings
		)
	}, [data, tvlSettings])

	const chartData = React.useMemo(() => {
		return buildCompareChainsChartData(
			data
				.filter((d): d is ChainDataResult => d != null)
				.map((chainData) => ({
					...chainData,
					tvlChart: tvlCharts[chainData.chain]?.finalTvlChart ?? null
				})),
			selectedChartFilters
		)
	}, [data, selectedChartFilters, tvlCharts])

	return (
		<>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<div className="flex-1">
					<MultiSelectCombobox
						data={chains}
						placeholder="Select Chains..."
						selectedValues={selectedChainValues}
						setSelectedValues={(values: Array<string>) => {
							updateRoute('chains', values, router)
						}}
					/>
				</div>

				{selectedChains.length > 1 ? <ChartFilters /> : null}
			</div>

			{selectedChains.length > 1 ? (
				<div className="relative flex flex-col gap-1">
					{isChartLoading || !router.isReady ? (
						<ChartPanel>
							<ChartPanelExportShellFallback className="flex h-full w-full items-center justify-center">
								<LoadingIndicator />
							</ChartPanelExportShellFallback>
						</ChartPanel>
					) : (
						<ChartPanel>
							<FailedDataNote labels={failedChains} shows="The chart shows the other chains." />
							<React.Suspense fallback={<ChartPanelExportShellFallback />}>
								<MultiSeriesChart
									dataset={chartData.dataset}
									charts={chartData.charts}
									showTotalInTooltip={chartData.showTotalInTooltip}
									exportButtons={{
										png: true,
										csv: true,
										filename: `compare-chains-${selectedChains.map((chain) => chain.label).join('-vs-')}`,
										pngTitle: `${selectedChains.map((chain) => chain.label).join(' vs ')}`
									}}
								/>
							</React.Suspense>
						</ChartPanel>
					)}

					<div className="grid grow grid-cols-1 gap-1 xl:grid-cols-2">
						{data
							?.filter((d): d is ChainDataResult => d != null)
							.map((chainData, i) => (
								<div
									className="relative isolate flex flex-col justify-between gap-1 xl:grid-cols-[auto_1fr]"
									key={chainData.chain ?? i}
								>
									<Stats {...chainData.chainOverviewData} hideChart />
								</div>
							))}
					</div>
				</div>
			) : (
				<PanelStatus variant="empty">Select at least 2 chains to compare</PanelStatus>
			)}
		</>
	)
}

function useChainsChartFilterState() {
	const router = useRouter()

	const selectedValues = supportedCharts
		.map((chart) => chart.key)
		.filter((chart) => (chart === 'tvlChart' ? router.query[chart] !== 'false' : router.query[chart] === 'true'))

	const setSelectedValues: React.Dispatch<React.SetStateAction<Array<string> | string>> = (action) => {
		const resolved = typeof action === 'function' ? action(selectedValues) : action
		const valuesArray = (Array.isArray(resolved) ? resolved : [resolved]).filter(
			(value): value is string => typeof value === 'string'
		)
		const selectedSet = new Set(valuesArray)
		const chartFlags: Record<string, string> = {}
		for (const chart of supportedCharts) chartFlags[chart.key] = selectedSet.has(chart.key) ? 'true' : 'false'

		void router.push(
			{
				query: {
					chains: router.query.chains,
					...chartFlags
				}
			},
			undefined,
			{ shallow: true }
		)
	}

	return { selectedValues, setSelectedValues }
}
