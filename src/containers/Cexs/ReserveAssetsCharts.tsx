import { useRouter } from 'next/router'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { createInflowsTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/tooltip'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import {
	buildRuntimePieChartCsvDataset,
	buildRuntimePieChartPresentation,
	type RuntimePieChartData
} from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { oldBlue } from '~/constants/colors'
import { CexChartPanel, cexChartFallback } from '~/containers/Cexs/CexChartPanel'
import type { ProtocolExtraTvlKey } from '~/containers/ProtocolOverview/tvlChart'
import {
	type ProtocolBreakdownChart,
	useProtocolBreakdownCharts
} from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import { useProtocolBreakdownPresentation } from '~/containers/ProtocolOverview/useProtocolBreakdownPresentation'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { CHART_FILL } from '~/ui/ChartPanel'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { Switch } from '~/ui/Switch'
import { slug } from '~/utils'
import { exchangeIconUrl } from '~/utils/icons'
import { pushShallowQuery } from '~/utils/routerQuery'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

const INFLOWS_TOOLTIP_FORMATTER_USD = createInflowsTooltipFormatter({ groupBy: 'daily', valueSymbol: '$' })
const EMPTY_CHART_KEYS: Array<ProtocolExtraTvlKey> = []
const USD_INFLOWS_SERIES = new Set(['USD Inflows'])

const reserveExchangeIconUrl = (protocolName: string) => exchangeIconUrl(slug(protocolName.replace(/-cex$/, '')))

/** includeOwnTokens is off by default and only enabled via URL query. Read after router is ready to avoid hydration mismatch. */
export function useIncludeOwnTokens() {
	const router = useRouter()
	const includeOwnTokens = router.isReady && router.query.includeOwnTokens === 'true'
	const toggleIncludeOwnTokens = (event: React.ChangeEvent<HTMLInputElement>) => {
		void pushShallowQuery(router, { includeOwnTokens: event.currentTarget.checked ? 'true' : undefined })
	}
	return { includeOwnTokens, toggleIncludeOwnTokens }
}

export function IncludeOwnTokensSwitch({ ownToken }: { ownToken: string }) {
	const { includeOwnTokens, toggleIncludeOwnTokens } = useIncludeOwnTokens()
	return (
		<Switch
			value="includeOwnTokens"
			label={`Include own tokens (${ownToken})`}
			checked={includeOwnTokens}
			onChange={toggleIncludeOwnTokens}
			className="gap-2"
		/>
	)
}

function ChainsChartCard({
	protocolName,
	allChains,
	breakdown
}: {
	protocolName: string
	allChains: Array<string>
	breakdown: ProtocolBreakdownChart
}) {
	const {
		activeSeries: selectedChains,
		setSelectedSeries: setSelectedChains,
		dataset,
		charts,
		selectedCharts,
		csvSource
	} = useProtocolBreakdownPresentation({
		scope: `${slug(protocolName)}-chains`,
		breakdown,
		availableSeries: allChains,
		aggregateOthers: true,
		type: 'line'
	})

	const { chartInstance, handleChartReady } = useGetChartInstance()

	const exportFilenameBase = `${slug(protocolName)}-chains`
	const exportTitle = `${protocolName} Assets by Chain`

	return (
		<CexChartPanel
			title="Chains"
			controls={
				<>
					{allChains.length > 1 ? (
						<SelectWithCombobox
							allValues={allChains}
							selectedValues={selectedChains}
							setSelectedValues={setSelectedChains}
							label="Chain"
							labelType="smol"
							variant="filter"
							size="md"
						/>
					) : null}
					<ChartExportButtons
						chartInstance={chartInstance}
						filename={exportFilenameBase}
						title={exportTitle}
						iconUrl={reserveExchangeIconUrl(protocolName)}
						csvSource={csvSource}
					/>
				</>
			}
		>
			<React.Suspense fallback={cexChartFallback}>
				<MultiSeriesChart
					dataset={dataset}
					charts={charts}
					containerClassName={CHART_FILL}
					csvSource={csvSource}
					hideDefaultLegend={false}
					valueSymbol="$"
					selectedCharts={selectedCharts}
					showTotalInTooltip
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</CexChartPanel>
	)
}

function TokenValuesUSDChartCard({
	protocolName,
	allTokens,
	breakdown
}: {
	protocolName: string
	allTokens: Array<string>
	breakdown: ProtocolBreakdownChart
}) {
	const {
		activeSeries: selectedTokensUSD,
		setSelectedSeries: setSelectedTokensUSD,
		dataset,
		charts,
		selectedCharts,
		csvSource
	} = useProtocolBreakdownPresentation({
		scope: `${slug(protocolName)}-token-values-usd`,
		breakdown,
		availableSeries: allTokens,
		aggregateOthers: true,
		type: 'line'
	})

	const { chartInstance, handleChartReady } = useGetChartInstance()

	const exportFilenameBase = `${slug(protocolName)}-token-values-usd`
	const exportTitle = `${protocolName} Asset Values by Token`

	return (
		<CexChartPanel
			title="Token Values (USD)"
			controls={
				<>
					{allTokens.length > 1 ? (
						<SelectWithCombobox
							allValues={allTokens}
							selectedValues={selectedTokensUSD}
							setSelectedValues={setSelectedTokensUSD}
							label="Token"
							labelType="smol"
							variant="filter"
							size="md"
						/>
					) : null}
					<ChartExportButtons
						chartInstance={chartInstance}
						filename={exportFilenameBase}
						title={exportTitle}
						iconUrl={reserveExchangeIconUrl(protocolName)}
						csvSource={csvSource}
					/>
				</>
			}
		>
			<React.Suspense fallback={cexChartFallback}>
				<MultiSeriesChart
					dataset={dataset}
					charts={charts}
					containerClassName={CHART_FILL}
					csvSource={csvSource}
					hideDefaultLegend={false}
					valueSymbol="$"
					selectedCharts={selectedCharts}
					showTotalInTooltip
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</CexChartPanel>
	)
}

function TokensBreakdownPieChartCard({
	tokenBreakdownPieSeries,
	protocolName
}: {
	tokenBreakdownPieSeries: RuntimePieChartData
	protocolName: string
}) {
	const selectableSeries = React.useMemo(
		() => tokenBreakdownPieSeries.peers.map((peer) => peer.name),
		[tokenBreakdownPieSeries.peers]
	)
	const {
		activeSeries: selectedTokens,
		selectedCharts,
		setSelectedSeries: setSelectedTokens
	} = useLocalSelection({
		scope: `${slug(protocolName)}-tokens-breakdown`,
		allowEmptySelection: true,
		availableSeries: selectableSeries
	})
	const presentation = React.useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: tokenBreakdownPieSeries,
				selectedSeries: selectedCharts
			}),
		[selectedCharts, tokenBreakdownPieSeries]
	)

	const { chartInstance, handleChartReady } = useGetChartInstance()

	const exportFilenameBase = `${slug(protocolName)}-tokens-breakdown`
	const exportTitle = `${protocolName} Assets by Token`

	return (
		<CexChartPanel
			title="Tokens Breakdown"
			controls={
				<>
					{selectableSeries.length > 1 ? (
						<SelectWithCombobox
							allValues={selectableSeries}
							selectedValues={selectedTokens}
							setSelectedValues={setSelectedTokens}
							label="Token"
							labelType="smol"
							variant="filter"
							size="md"
						/>
					) : null}
					<ChartExportButtons
						chartInstance={chartInstance}
						filename={exportFilenameBase}
						title={exportTitle}
						iconUrl={reserveExchangeIconUrl(protocolName)}
						csvSource={{
							type: 'dataset',
							prepare: () =>
								buildRuntimePieChartCsvDataset({
									series: tokenBreakdownPieSeries,
									selectedSeries: selectedCharts
								})
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

function TokenBalancesRawChartCard({
	protocolName,
	allTokens,
	defaultTokens,
	breakdown
}: {
	protocolName: string
	allTokens: Array<string>
	defaultTokens: Array<string>
	breakdown: ProtocolBreakdownChart
}) {
	const {
		activeSeries: selectedTokensRaw,
		setSelectedSeries: setSelectedTokensRaw,
		dataset,
		charts,
		selectedCharts,
		csvSource
	} = useProtocolBreakdownPresentation({
		scope: `${slug(protocolName)}-token-balances-raw`,
		breakdown,
		availableSeries: allTokens,
		defaultSeries: defaultTokens,
		aggregateOthers: false,
		type: 'line'
	})

	const { chartInstance, handleChartReady } = useGetChartInstance()

	const exportFilenameBase = `${slug(protocolName)}-token-balances-raw`
	const exportTitle = `${protocolName} Token Balances`

	return (
		<CexChartPanel
			title="Token Balances (Raw Quantities)"
			controls={
				<>
					{allTokens.length > 1 ? (
						<SelectWithCombobox
							allValues={allTokens}
							selectedValues={selectedTokensRaw}
							setSelectedValues={setSelectedTokensRaw}
							label="Token"
							labelType="smol"
							variant="filter"
							size="md"
						/>
					) : null}
					<ChartExportButtons
						chartInstance={chartInstance}
						filename={exportFilenameBase}
						title={exportTitle}
						iconUrl={reserveExchangeIconUrl(protocolName)}
						csvSource={csvSource}
					/>
				</>
			}
		>
			<React.Suspense fallback={cexChartFallback}>
				<MultiSeriesChart
					dataset={dataset}
					charts={charts}
					containerClassName={CHART_FILL}
					csvSource={csvSource}
					hideDefaultLegend={false}
					valueSymbol=""
					selectedCharts={selectedCharts}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</CexChartPanel>
	)
}

function USDInflowsChartCard({ protocolName, dataset }: { protocolName: string; dataset: MultiSeriesChartDataset }) {
	const { chartInstance, handleChartReady } = useGetChartInstance()

	const exportFilenameBase = `${slug(protocolName)}-usd-inflows`
	const exportTitle = protocolName

	return (
		<CexChartPanel
			title="USD Inflows"
			controls={
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={exportFilenameBase}
					title={exportTitle}
					iconUrl={reserveExchangeIconUrl(protocolName)}
					csvSource={{ type: 'dataset', prepare: () => dataset }}
				/>
			}
		>
			<React.Suspense fallback={cexChartFallback}>
				<MultiSeriesChart
					dataset={dataset}
					charts={USD_INFLOWS_CHARTS}
					containerClassName={CHART_FILL}
					valueSymbol="$"
					selectedCharts={USD_INFLOWS_SERIES}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</CexChartPanel>
	)
}

function InflowsByTokenChartCard({
	protocolName,
	allTokens,
	breakdown
}: {
	protocolName: string
	allTokens: Array<string>
	breakdown: ProtocolBreakdownChart
}) {
	const {
		activeSeries: selectedTokenInflows,
		setSelectedSeries: setSelectedTokenInflows,
		dataset,
		charts,
		selectedCharts,
		csvSource
	} = useProtocolBreakdownPresentation({
		scope: `${slug(protocolName)}-inflows-by-token`,
		breakdown,
		availableSeries: allTokens,
		aggregateOthers: true,
		type: 'bar',
		stack: 'tokenInflows'
	})

	const { chartInstance, handleChartReady } = useGetChartInstance()

	const exportFilenameBase = `${slug(protocolName)}-inflows-by-token`
	const exportTitle = `${protocolName} Inflows`

	return (
		<CexChartPanel
			title="Inflows by Token"
			controls={
				<>
					{allTokens.length > 1 ? (
						<SelectWithCombobox
							allValues={allTokens}
							selectedValues={selectedTokenInflows}
							setSelectedValues={setSelectedTokenInflows}
							label="Token"
							labelType="smol"
							variant="filter"
							size="md"
						/>
					) : null}
					<ChartExportButtons
						chartInstance={chartInstance}
						filename={exportFilenameBase}
						title={exportTitle}
						iconUrl={reserveExchangeIconUrl(protocolName)}
						csvSource={csvSource}
					/>
				</>
			}
		>
			<React.Suspense fallback={cexChartFallback}>
				<MultiSeriesChart
					dataset={dataset}
					charts={charts}
					containerClassName={CHART_FILL}
					csvSource={csvSource}
					hideDefaultLegend={false}
					valueSymbol="$"
					selectedCharts={selectedCharts}
					{...(selectedCharts.size > 1
						? { chartOptions: { tooltip: { formatter: INFLOWS_TOOLTIP_FORMATTER_USD } } }
						: {})}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</CexChartPanel>
	)
}

/**
 * Reserve-asset breakdown charts for a tracked CEX, fetched client-side from
 * /api/public/protocols/charts. `protocol` is the DefiLlama protocol slug
 * (e.g. "binance-cex"); `displayName` only drives labels and export titles.
 */
export function ReserveAssetsCharts({
	protocol,
	displayName,
	ownToken
}: {
	protocol: string
	displayName: string
	ownToken: string | null
}) {
	const { includeOwnTokens } = useIncludeOwnTokens()
	const tokensToExclude = React.useMemo(() => {
		if (includeOwnTokens || !ownToken) return []
		return [ownToken]
	}, [includeOwnTokens, ownToken])

	const {
		isLoading,
		errors,
		chainsUnique,
		tokensUnique,
		rawTokensUnique,
		inflowTokensUnique,
		defaultRawTokens,
		chainBreakdown,
		tokenRawBreakdown,
		tokenBreakdownUSD,
		tokenBreakdownPieSeries,
		usdInflowsDataset,
		tokenInflows
	} = useProtocolBreakdownCharts({
		protocol,
		keys: EMPTY_CHART_KEYS,
		includeBase: true,
		tokensToExclude,
		tokenPieMinimumValue: 0
	})

	const hasBreakdownMetrics =
		(chainBreakdown && chainsUnique.length > 1) ||
		(tokenBreakdownUSD && tokensUnique.length > 0) ||
		(tokenBreakdownUSD &&
			tokenBreakdownUSD.length > 1 &&
			tokensUnique.length > 0 &&
			(tokenBreakdownPieSeries.peers.length > 0 || tokenBreakdownPieSeries.upstreamOthersValue > 0)) ||
		(tokenRawBreakdown && rawTokensUnique.length > 0) ||
		usdInflowsDataset ||
		(tokenInflows && inflowTokensUnique.length > 0)

	if (isLoading) return <PanelLoadingStatus />
	if (!hasBreakdownMetrics && errors.length === 0) {
		return (
			<PanelStatus variant="empty" className="col-span-full">
				Breakdown metrics are not available
			</PanelStatus>
		)
	}

	return (
		<div className="grid grid-cols-2 gap-2">
			{errors.length > 0 ? (
				<PanelStatus variant="error" className="col-span-full">
					Failed to fetch reserve asset breakdown APIs
				</PanelStatus>
			) : null}
			{chainBreakdown && chainsUnique.length > 1 ? (
				<ChainsChartCard protocolName={displayName} allChains={chainsUnique} breakdown={chainBreakdown} />
			) : null}

			{tokenBreakdownUSD && tokensUnique.length > 0 ? (
				<TokenValuesUSDChartCard protocolName={displayName} allTokens={tokensUnique} breakdown={tokenBreakdownUSD} />
			) : null}

			{tokenBreakdownUSD &&
			tokenBreakdownUSD.length > 1 &&
			tokensUnique.length > 0 &&
			(tokenBreakdownPieSeries.peers.length > 0 || tokenBreakdownPieSeries.upstreamOthersValue > 0) ? (
				<TokensBreakdownPieChartCard tokenBreakdownPieSeries={tokenBreakdownPieSeries} protocolName={displayName} />
			) : null}

			{tokenRawBreakdown && rawTokensUnique.length > 0 ? (
				<TokenBalancesRawChartCard
					protocolName={displayName}
					allTokens={rawTokensUnique}
					defaultTokens={defaultRawTokens}
					breakdown={tokenRawBreakdown}
				/>
			) : null}

			{usdInflowsDataset ? <USDInflowsChartCard protocolName={displayName} dataset={usdInflowsDataset} /> : null}

			{tokenInflows && inflowTokensUnique.length > 0 ? (
				<InflowsByTokenChartCard protocolName={displayName} allTokens={inflowTokensUnique} breakdown={tokenInflows} />
			) : null}
		</div>
	)
}

const USD_INFLOWS_CHARTS = [
	{ type: 'bar' as const, name: 'USD Inflows', encode: { x: 'timestamp', y: 'USD Inflows' }, color: oldBlue }
]
