import { useRouter } from 'next/router'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { createInflowsTooltipFormatter } from '~/components/ECharts/formatters'
import type { IMultiSeriesChart2Props, IPieChartProps, MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import { preparePieChartData } from '~/components/ECharts/utils'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { oldBlue } from '~/constants/colors'
import { CexChartPanel, cexChartFallback } from '~/containers/Cexs/CexChartPanel'
import { useProtocolBreakdownCharts } from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useSelectedValues } from '~/hooks/useSelectedValues'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { Switch } from '~/ui/Switch'
import { slug } from '~/utils'
import { tokenIconUrl } from '~/utils/icons'
import { pushShallowQuery } from '~/utils/routerQuery'

const MultiSeriesChart2 = React.lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

const INFLOWS_TOOLTIP_FORMATTER_USD = createInflowsTooltipFormatter({ groupBy: 'daily', valueSymbol: '$' })
const EMPTY_CHART_KEYS: string[] = []
const USD_INFLOWS_SERIES = new Set(['USD Inflows'])

type MultiSeriesCharts = NonNullable<IMultiSeriesChart2Props['charts']>

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
	dataset,
	charts
}: {
	protocolName: string
	allChains: string[]
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesCharts
}) {
	const [selectedChains, setSelectedChains] = useSelectedValues(allChains)

	const selectedChainsSet = React.useMemo(() => new Set(selectedChains), [selectedChains])

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
						iconUrl={tokenIconUrl(protocolName)}
					/>
				</>
			}
		>
			<React.Suspense fallback={cexChartFallback}>
				<MultiSeriesChart2
					dataset={dataset}
					charts={charts}
					valueSymbol="$"
					selectedCharts={selectedChainsSet}
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
	dataset,
	charts
}: {
	protocolName: string
	allTokens: string[]
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesCharts
}) {
	const [selectedTokensUSD, setSelectedTokensUSD] = useSelectedValues(allTokens)

	const selectedTokensUSDSet = React.useMemo(() => new Set(selectedTokensUSD), [selectedTokensUSD])

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
						iconUrl={tokenIconUrl(protocolName)}
					/>
				</>
			}
		>
			<React.Suspense fallback={cexChartFallback}>
				<MultiSeriesChart2
					dataset={dataset}
					charts={charts}
					valueSymbol="$"
					selectedCharts={selectedTokensUSDSet}
					showTotalInTooltip
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</CexChartPanel>
	)
}

function TokensBreakdownPieChartCard({
	tokenBreakdownLatest,
	protocolName
}: {
	tokenBreakdownLatest: Record<string, number>
	protocolName: string
}) {
	const allTokens = React.useMemo(
		() =>
			Object.keys(tokenBreakdownLatest).sort((a, b) => (tokenBreakdownLatest[b] ?? 0) - (tokenBreakdownLatest[a] ?? 0)),
		[tokenBreakdownLatest]
	)
	const [selectedTokens, setSelectedTokens] = useSelectedValues(allTokens)

	const chartData = React.useMemo(() => {
		if (selectedTokens.length === 0) return []
		const selectedBreakdown: Record<string, number> = {}
		for (const token of selectedTokens) {
			selectedBreakdown[token] = tokenBreakdownLatest[token] ?? 0
		}
		return preparePieChartData({ data: selectedBreakdown, limit: 15 })
	}, [selectedTokens, tokenBreakdownLatest])

	const { chartInstance, handleChartReady } = useGetChartInstance()

	const exportFilenameBase = `${slug(protocolName)}-tokens-breakdown`
	const exportTitle = `${protocolName} Assets by Token`

	return (
		<CexChartPanel
			title="Tokens Breakdown"
			controls={
				<>
					{allTokens.length > 1 ? (
						<SelectWithCombobox
							allValues={allTokens}
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
						iconUrl={tokenIconUrl(protocolName)}
					/>
				</>
			}
		>
			<React.Suspense fallback={cexChartFallback}>
				<PieChart chartData={chartData} onReady={handleChartReady} />
			</React.Suspense>
		</CexChartPanel>
	)
}

function TokenBalancesRawChartCard({
	protocolName,
	allTokens,
	dataset,
	charts
}: {
	protocolName: string
	allTokens: string[]
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesCharts
}) {
	const [selectedTokensRaw, setSelectedTokensRaw] = useSelectedValues(allTokens)

	const selectedTokensRawSet = React.useMemo(() => new Set(selectedTokensRaw), [selectedTokensRaw])

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
						iconUrl={tokenIconUrl(protocolName)}
					/>
				</>
			}
		>
			<React.Suspense fallback={cexChartFallback}>
				<MultiSeriesChart2
					dataset={dataset}
					charts={charts}
					valueSymbol=""
					selectedCharts={selectedTokensRawSet}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</CexChartPanel>
	)
}

function USDInflowsChartCard({ protocolName, dataset }: { protocolName: string; dataset: MultiSeriesChart2Dataset }) {
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
					iconUrl={tokenIconUrl(protocolName)}
				/>
			}
		>
			<React.Suspense fallback={cexChartFallback}>
				<MultiSeriesChart2
					dataset={dataset}
					charts={USD_INFLOWS_CHARTS}
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
	dataset,
	charts
}: {
	protocolName: string
	allTokens: string[]
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesCharts
}) {
	const [selectedTokenInflows, setSelectedTokenInflows] = useSelectedValues(allTokens)

	const selectedTokenInflowsSet = React.useMemo(() => new Set(selectedTokenInflows), [selectedTokenInflows])

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
						iconUrl={tokenIconUrl(protocolName)}
					/>
				</>
			}
		>
			<React.Suspense fallback={cexChartFallback}>
				<MultiSeriesChart2
					dataset={dataset}
					charts={charts}
					hideDefaultLegend={true}
					valueSymbol="$"
					selectedCharts={selectedTokenInflowsSet}
					chartOptions={
						selectedTokenInflowsSet.size > 1 ? { tooltip: { formatter: INFLOWS_TOOLTIP_FORMATTER_USD } } : undefined
					}
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
		chainsUnique,
		tokensUnique,
		rawTokensUnique,
		chainsDataset,
		chainsCharts,
		tokenUSDDataset,
		tokenUSDCharts,
		tokenRawDataset,
		tokenRawCharts,
		tokenBreakdownUSD,
		tokenBreakdownLatest,
		tokenBreakdownPieChart,
		usdInflowsDataset,
		tokenInflowsDataset,
		tokenInflowsCharts
	} = useProtocolBreakdownCharts({
		protocol,
		keys: EMPTY_CHART_KEYS,
		includeBase: true,
		tokensToExclude
	})

	const hasBreakdownMetrics =
		(chainsDataset && chainsUnique?.length > 1) ||
		(tokenUSDDataset && tokensUnique?.length > 0) ||
		(tokenBreakdownUSD?.length > 1 && tokensUnique?.length > 0 && tokenBreakdownPieChart?.length > 0) ||
		(tokenRawDataset && rawTokensUnique.length > 0) ||
		usdInflowsDataset ||
		(tokenInflowsDataset && tokensUnique?.length > 0)

	if (isLoading) return <PanelLoadingStatus />
	if (!hasBreakdownMetrics) {
		return (
			<PanelStatus variant="empty" className="col-span-full">
				Breakdown metrics are not available
			</PanelStatus>
		)
	}

	return (
		<div className="grid grid-cols-2 gap-2">
			{chainsDataset && chainsUnique?.length > 1 ? (
				<ChainsChartCard
					protocolName={displayName}
					allChains={chainsUnique}
					dataset={chainsDataset}
					charts={chainsCharts}
				/>
			) : null}

			{tokenUSDDataset && tokensUnique?.length > 0 ? (
				<TokenValuesUSDChartCard
					protocolName={displayName}
					allTokens={tokensUnique}
					dataset={tokenUSDDataset}
					charts={tokenUSDCharts}
				/>
			) : null}

			{tokenBreakdownUSD?.length > 1 && tokensUnique?.length > 0 && tokenBreakdownPieChart?.length > 0 ? (
				<TokensBreakdownPieChartCard tokenBreakdownLatest={tokenBreakdownLatest} protocolName={displayName} />
			) : null}

			{tokenRawDataset && rawTokensUnique.length > 0 ? (
				<TokenBalancesRawChartCard
					protocolName={displayName}
					allTokens={rawTokensUnique}
					dataset={tokenRawDataset}
					charts={tokenRawCharts}
				/>
			) : null}

			{usdInflowsDataset ? <USDInflowsChartCard protocolName={displayName} dataset={usdInflowsDataset} /> : null}

			{tokenInflowsDataset && tokensUnique?.length > 0 ? (
				<InflowsByTokenChartCard
					protocolName={displayName}
					allTokens={tokensUnique}
					dataset={tokenInflowsDataset}
					charts={tokenInflowsCharts}
				/>
			) : null}
		</div>
	)
}

const USD_INFLOWS_CHARTS = [
	{ type: 'bar' as const, name: 'USD Inflows', encode: { x: 'timestamp', y: 'USD Inflows' }, color: oldBlue }
]
