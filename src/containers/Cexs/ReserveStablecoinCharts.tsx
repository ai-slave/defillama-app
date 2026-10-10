import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import {
	buildSelectedAdditiveChart,
	rankSeriesByPeakAbsoluteValue
} from '~/components/ECharts/MultiSeriesChart/selection'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import {
	buildRuntimePieChartCsvDataset,
	buildRuntimePieChartPresentation,
	type RuntimePieChartData
} from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { CexChartPanel, cexChartFallback } from '~/containers/Cexs/CexChartPanel'
import {
	buildReserveStablecoinChartData,
	getReserveStablecoinViewState,
	type ReserveStablecoinChartData
} from '~/containers/Cexs/reserveStablecoinChartData'
import { fetchProtocolTvlTokenBreakdownChart } from '~/containers/ProtocolOverview/api'
import type { IProtocolTokenBreakdownChart } from '~/containers/ProtocolOverview/api.types'
import { fetchStablecoinAssetsApi } from '~/containers/Stablecoins/api'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { CHART_FILL } from '~/ui/ChartPanel'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { InlineStatStrip } from '~/ui/SummaryStats'
import { slug } from '~/utils'
import { exchangeIconUrl } from '~/utils/icons'
import { formatUsd, formatPercent } from '~/utils/numberFormat'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

type MultiSeriesCharts = NonNullable<IMultiSeriesChartProps['charts']>

function MultiSeriesChartCard({
	title,
	filterLabel,
	dataset,
	charts,
	valueSymbol,
	exportFilenameBase,
	exportTitle,
	exportIconUrl
}: {
	title: string
	filterLabel: string
	dataset: MultiSeriesChartDataset
	charts: MultiSeriesCharts
	valueSymbol?: string
	exportFilenameBase: string
	exportTitle: string
	exportIconUrl?: string
}) {
	const allValues = React.useMemo(
		() =>
			rankSeriesByPeakAbsoluteValue(
				dataset,
				charts.map((chart) => chart.name).filter((name) => name !== 'Others')
			),
		[charts, dataset]
	)
	const { activeSeries, selectedCharts, setSelectedSeries, isDefaultSelection } = useLocalSelection({
		scope: exportFilenameBase,
		availableSeries: allValues
	})
	const presentation = React.useMemo(
		() =>
			buildSelectedAdditiveChart({
				dataset,
				charts,
				seriesOrder: allValues,
				selectedCharts,
				includeUpstreamRemainder: isDefaultSelection
			}),
		[allValues, charts, dataset, isDefaultSelection, selectedCharts]
	)

	const { chartInstance, handleChartReady } = useGetChartInstance()

	return (
		<CexChartPanel
			title={title}
			controls={
				<>
					{allValues.length > 1 ? (
						<SelectWithCombobox
							allValues={allValues}
							selectedValues={activeSeries}
							setSelectedValues={setSelectedSeries}
							label={filterLabel}
							labelType="smol"
							variant="filter"
							size="md"
						/>
					) : null}
					<ChartExportButtons
						chartInstance={chartInstance}
						filename={exportFilenameBase}
						title={exportTitle}
						iconUrl={exportIconUrl}
						csvSource={presentation.csvSource}
					/>
				</>
			}
		>
			<React.Suspense fallback={cexChartFallback}>
				<MultiSeriesChart
					dataset={presentation.dataset}
					charts={presentation.charts}
					containerClassName={CHART_FILL}
					csvSource={presentation.csvSource}
					{...(valueSymbol ? { valueSymbol } : {})}
					showLegend
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</CexChartPanel>
	)
}

function PieChartCard({
	title,
	series,
	exportFilenameBase,
	exportTitle,
	exportIconUrl
}: {
	title: string
	series: RuntimePieChartData
	exportFilenameBase: string
	exportTitle: string
	exportIconUrl?: string
}) {
	const selectableSeries = React.useMemo(() => series.peers.map((peer) => peer.name), [series.peers])
	const {
		activeSeries: selectedValues,
		selectedCharts,
		setSelectedSeries: setSelectedValues
	} = useLocalSelection({ scope: exportFilenameBase, allowEmptySelection: true, availableSeries: selectableSeries })
	const presentation = React.useMemo(
		() => buildRuntimePieChartPresentation({ series, selectedSeries: selectedCharts }),
		[selectedCharts, series]
	)

	const { chartInstance, handleChartReady } = useGetChartInstance()

	return (
		<CexChartPanel
			title={title}
			controls={
				<>
					{selectableSeries.length > 1 ? (
						<SelectWithCombobox
							allValues={selectableSeries}
							selectedValues={selectedValues}
							setSelectedValues={setSelectedValues}
							label="Backing"
							labelType="smol"
							variant="filter"
							size="md"
						/>
					) : null}
					<ChartExportButtons
						chartInstance={chartInstance}
						filename={exportFilenameBase}
						title={exportTitle}
						iconUrl={exportIconUrl}
						csvSource={{
							type: 'dataset',
							prepare: () => buildRuntimePieChartCsvDataset({ series, selectedSeries: selectedCharts })
						}}
					/>
				</>
			}
		>
			<React.Suspense fallback={cexChartFallback}>
				<PieChart
					chartData={presentation.chartData}
					stackColors={presentation.stackColors}
					containerClassName={CHART_FILL}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</CexChartPanel>
	)
}

function useStablecoinData(protocolName: string) {
	const {
		data: tokenBreakdownData,
		isLoading: isTokenBreakdownLoading,
		isError: tokenBreakdownFailed,
		dataUpdatedAt: tokenBreakdownDataUpdatedAt
	} = useQuery<IProtocolTokenBreakdownChart>({
		queryKey: ['cex', protocolName, 'stablecoins', 'token-breakdown'],
		queryFn: () => fetchProtocolTvlTokenBreakdownChart({ protocol: protocolName }),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0
	})

	const {
		data: stablecoinsList,
		isLoading: isStablecoinsListLoading,
		isError: stablecoinListFailed,
		dataUpdatedAt: stablecoinsListUpdatedAt
	} = useQuery({
		queryKey: ['cex', 'stablecoins', 'list', 'v1'],
		queryFn: () => fetchStablecoinAssetsApi(),
		staleTime: 6 * 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0
	})

	const peggedAssets = stablecoinsList?.peggedAssets ?? []

	const {
		data,
		isLoading,
		isError: chartDataFailed
	} = useQuery<ReserveStablecoinChartData | null>({
		queryKey: [
			'cex',
			protocolName,
			'stablecoins',
			'charts-data',
			'v3',
			tokenBreakdownDataUpdatedAt,
			stablecoinsListUpdatedAt
		],
		queryFn: () => {
			if (!tokenBreakdownData || tokenBreakdownData.length === 0) return null
			if (peggedAssets.length === 0) return null

			return buildReserveStablecoinChartData(tokenBreakdownData, peggedAssets)
		},
		enabled: !!tokenBreakdownData?.length && peggedAssets.length > 0,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0
	})

	return getReserveStablecoinViewState({
		data: data ?? undefined,
		isLoading: isLoading || isTokenBreakdownLoading || isStablecoinsListLoading,
		tokenBreakdownFailed,
		stablecoinListFailed,
		chartDataFailed
	})
}

/**
 * Stablecoin composition charts for a tracked CEX's reserve wallets, fetched
 * client-side. `protocol` is the DefiLlama protocol identifier (slug or name,
 * e.g. "binance-cex"); `displayName` only drives labels and export titles.
 */
export function ReserveStablecoinCharts({ protocol, displayName }: { protocol: string; displayName: string }) {
	const state = useStablecoinData(protocol)

	const exchangeSlug = slug(displayName || 'cex')
	const buildFilename = (suffix: string) => `${exchangeSlug}-${slug(suffix)}`
	const stablecoinsExportTitle = displayName ? `${displayName} Stablecoins` : 'Stablecoins'
	const exchangeLogoUrl = exchangeIconUrl(exchangeSlug)

	if (state.status === 'loading') return <PanelLoadingStatus />
	if (state.status === 'unavailable')
		return <PanelStatus variant="error">Failed to load stablecoin reserve data</PanelStatus>
	if (state.status === 'empty')
		return <PanelStatus variant="empty">No stablecoin data available for this exchange</PanelStatus>

	const {
		currentTotal,
		stablecoinBreakdown,
		pegMechanismPieSeries,
		totalStablecoins,
		stablecoinsByPegMechanism,
		stablecoinsByPegType,
		stablecoinsByToken,
		currentStablecoinCount
	} = state.data
	const dominantBacking = stablecoinBreakdown[0]

	return (
		<>
			<InlineStatStrip
				items={[
					{
						label: 'Total Stablecoin in CEX',
						value:
							currentTotal != null
								? formatUsd(currentTotal, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
								: '-'
					},
					...(dominantBacking
						? [
								{
									label: 'Dominant Backing Type',
									value: (
										<>
											<span className="capitalize">{dominantBacking.mechanism.replace('-', ' ')}</span>{' '}
											<span className="text-tertiary">
												(
												{formatPercent(dominantBacking.percentage, {
													input: 'percent',
													minimumFractionDigits: 1,
													maximumFractionDigits: 1,
													useGrouping: false
												})}
												)
											</span>
										</>
									)
								},
								{
									label: 'Fiat-Backed %',
									value:
										formatPercent(stablecoinBreakdown.find((b) => b.mechanism === 'fiat-backed')?.percentage, {
											input: 'percent',
											minimumFractionDigits: 1,
											maximumFractionDigits: 1,
											useGrouping: false
										}) ?? '0%'
								}
							]
						: []),
					{
						label: 'Number of Stablecoins',
						value: currentStablecoinCount
					}
				]}
			/>

			<div className="grid grid-cols-2 gap-2">
				{totalStablecoins ? (
					<MultiSeriesChartCard
						title="Total Stablecoin in CEX"
						filterLabel="Stablecoins"
						dataset={totalStablecoins.dataset}
						charts={totalStablecoins.charts}
						valueSymbol="$"
						exportFilenameBase={buildFilename('total-stablecoin-in-cex')}
						exportTitle={stablecoinsExportTitle}
						exportIconUrl={exchangeLogoUrl}
					/>
				) : null}

				{stablecoinsByPegMechanism ? (
					<MultiSeriesChartCard
						title="Stablecoins by Backing Type"
						filterLabel="Backing"
						dataset={stablecoinsByPegMechanism.dataset}
						charts={stablecoinsByPegMechanism.charts}
						valueSymbol="$"
						exportFilenameBase={buildFilename('stablecoins-by-backing-type')}
						exportTitle={stablecoinsExportTitle}
						exportIconUrl={exchangeLogoUrl}
					/>
				) : null}

				{pegMechanismPieSeries.peers.length > 0 || pegMechanismPieSeries.upstreamOthersValue > 0 ? (
					<PieChartCard
						title="Distribution by Backing Type"
						series={pegMechanismPieSeries}
						exportFilenameBase={buildFilename('stablecoins-backing-type')}
						exportTitle={stablecoinsExportTitle}
						exportIconUrl={exchangeLogoUrl}
					/>
				) : null}

				{stablecoinsByPegType ? (
					<MultiSeriesChartCard
						title="Stablecoins by Currency Peg"
						filterLabel="Currency"
						dataset={stablecoinsByPegType.dataset}
						charts={stablecoinsByPegType.charts}
						valueSymbol="$"
						exportFilenameBase={buildFilename('stablecoins-by-currency-peg')}
						exportTitle={stablecoinsExportTitle}
						exportIconUrl={exchangeLogoUrl}
					/>
				) : null}

				{stablecoinsByToken ? (
					<MultiSeriesChartCard
						title="Individual Stablecoins"
						filterLabel="Token"
						dataset={stablecoinsByToken.dataset}
						charts={stablecoinsByToken.charts}
						valueSymbol="$"
						exportFilenameBase={buildFilename('individual-stablecoins')}
						exportTitle={stablecoinsExportTitle}
						exportIconUrl={exchangeLogoUrl}
					/>
				) : null}
			</div>
		</>
	)
}
