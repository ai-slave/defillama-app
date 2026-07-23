import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import {
	buildSelectedAdditiveChart,
	buildSelectedSeriesCsv,
	rankSeriesByPeakAbsoluteValue
} from '~/components/ECharts/MultiSeriesChart/selection'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { buildRuntimePieChartPresentation, type RuntimePieChartData } from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { CexChartPanel, cexChartFallback } from '~/containers/Cexs/CexChartPanel'
import {
	buildReserveStablecoinChartData,
	type ReserveStablecoinChartData
} from '~/containers/Cexs/reserveStablecoinChartData'
import { fetchProtocolTvlTokenBreakdownChart } from '~/containers/ProtocolOverview/api'
import type { IProtocolTokenBreakdownChart } from '~/containers/ProtocolOverview/api.types'
import { fetchStablecoinAssetsApi } from '~/containers/Stablecoins/api'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useAllSeriesSelection, useSeriesSelection } from '~/hooks/useSeriesSelection'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { InlineStatStrip } from '~/ui/SummaryStats'
import { formattedNum, slug } from '~/utils'
import { exchangeIconUrl } from '~/utils/icons'

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
	const { activeSeries, selectedCharts, setSelectedSeries, isDefaultSelection } = useSeriesSelection({
		availableSeries: allValues,
		storeDefaultAsIntent: true
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
						prepareCsvDirect={() =>
							buildSelectedSeriesCsv({
								dataset: presentation.dataset,
								charts: presentation.charts,
								selectedCharts: new Set(presentation.charts.map((chart) => chart.name)),
								filename: exportFilenameBase
							})
						}
					/>
				</>
			}
		>
			<React.Suspense fallback={cexChartFallback}>
				<MultiSeriesChart
					dataset={presentation.dataset}
					charts={presentation.charts}
					valueSymbol={valueSymbol}
					hideDefaultLegend={false}
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
		setSelectedSeries: setSelectedValues,
		includeUpstreamOthers
	} = useAllSeriesSelection({ availableSeries: selectableSeries })
	const presentation = React.useMemo(
		() => buildRuntimePieChartPresentation({ series, selectedSeries: selectedCharts, includeUpstreamOthers }),
		[includeUpstreamOthers, selectedCharts, series]
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
					/>
				</>
			}
		>
			<React.Suspense fallback={cexChartFallback}>
				<PieChart
					chartData={presentation.chartData}
					stackColors={presentation.stackColors}
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
		dataUpdatedAt: tokenBreakdownDataUpdatedAt
	} = useQuery<IProtocolTokenBreakdownChart | null>({
		queryKey: ['cex', protocolName, 'stablecoins', 'token-breakdown'],
		queryFn: () => fetchProtocolTvlTokenBreakdownChart({ protocol: protocolName }),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0
	})

	const {
		data: stablecoinsList,
		isLoading: isStablecoinsListLoading,
		dataUpdatedAt: stablecoinsListUpdatedAt
	} = useQuery({
		queryKey: ['cex', 'stablecoins', 'list', 'v1'],
		queryFn: () => fetchStablecoinAssetsApi(),
		staleTime: 6 * 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0
	})

	const peggedAssets = stablecoinsList?.peggedAssets ?? []

	const { data, isLoading } = useQuery<ReserveStablecoinChartData | null>({
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
			if (!peggedAssets || peggedAssets.length === 0) return null

			return buildReserveStablecoinChartData(tokenBreakdownData, peggedAssets)
		},
		enabled: !!tokenBreakdownData?.length && peggedAssets.length > 0,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0
	})

	return { data, isLoading: isLoading || isTokenBreakdownLoading || isStablecoinsListLoading }
}

/**
 * Stablecoin composition charts for a tracked CEX's reserve wallets, fetched
 * client-side. `protocol` is the DefiLlama protocol identifier (slug or name,
 * e.g. "binance-cex"); `displayName` only drives labels and export titles.
 */
export function ReserveStablecoinCharts({ protocol, displayName }: { protocol: string; displayName: string }) {
	const { data, isLoading } = useStablecoinData(protocol)

	const exchangeSlug = slug(displayName || 'cex')
	const buildFilename = (suffix: string) => `${exchangeSlug}-${slug(suffix)}`
	const stablecoinsExportTitle = displayName ? `${displayName} Stablecoins` : 'Stablecoins'
	const exchangeLogoUrl = exchangeIconUrl(exchangeSlug)

	if (isLoading) return <PanelLoadingStatus />
	if (!data) return <PanelStatus variant="empty">No stablecoin data available for this exchange</PanelStatus>

	const {
		currentTotal,
		stablecoinBreakdown,
		pegMechanismPieSeries,
		totalStablecoins,
		stablecoinsByPegMechanism,
		stablecoinsByPegType,
		stablecoinsByToken
	} = data

	return (
		<>
			<InlineStatStrip
				items={[
					{
						label: 'Total Stablecoin in CEX',
						value: currentTotal ? formattedNum(currentTotal, true) : '-'
					},
					...(stablecoinBreakdown.length > 0
						? [
								{
									label: 'Dominant Backing Type',
									value: <span className="capitalize">{stablecoinBreakdown[0].mechanism.replace('-', ' ')}</span>,
									change: `(${stablecoinBreakdown[0].percentage.toFixed(1)}%)`,
									changeClassName: 'text-tertiary'
								},
								{
									label: 'Fiat-Backed %',
									value: `${stablecoinBreakdown.find((b) => b.mechanism === 'fiat-backed')?.percentage.toFixed(1) || '0'}%`
								},
								{
									label: 'Number of Stablecoins',
									value: data.stablecoinTokensUnique?.length || 0
								}
							]
						: [])
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
