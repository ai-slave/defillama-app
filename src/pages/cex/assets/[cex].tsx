import type { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ButtonStyled/ChartExportButtons'
import { createAggregateTooltipFormatter, createInflowsTooltipFormatter } from '~/components/ECharts/formatters'
import type { IMultiSeriesChart2Props, IPieChartProps, MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import { preparePieChartData } from '~/components/ECharts/utils'
import { LocalLoader } from '~/components/Loaders'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TokenLogo } from '~/components/TokenLogo'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { oldBlue } from '~/constants/colors'
import { CexChartPanel, cexChartFallback } from '~/containers/Cexs/CexChartPanel'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import type { IProtocolPageMetrics } from '~/containers/ProtocolOverview/types'
import { useProtocolBreakdownCharts } from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { Switch } from '~/ui/Switch'
import { slug } from '~/utils'
import { tokenIconUrl } from '~/utils/icons'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'
import { pushShallowQuery } from '~/utils/routerQuery'

const MultiSeriesChart2 = React.lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

interface CexAssetsPageProps {
	name: string
	parentProtocol: string | null
	otherProtocols: string[]
	category: string | null
	metrics: Pick<IProtocolPageMetrics, 'tvl' | 'stablecoins'>
	ownToken: string | null
}

const INFLOWS_TOOLTIP_FORMATTER_USD = createInflowsTooltipFormatter({ groupBy: 'daily', valueSymbol: '$' })
const AGG_TOOLTIP_FORMATTER_USD = createAggregateTooltipFormatter({ groupBy: 'daily', valueSymbol: '$' })

export const getStaticProps = withPerformanceLogging(
	'cex/assets/[cex]',
	async ({ params }: GetStaticPropsContext<{ cex: string }>) => {
		if (!params?.cex) {
			return { notFound: true }
		}

		const exchangeName = params.cex
		const [{ default: metadataCache }, { resolveCexParamFromMetadata }] = await Promise.all([
			import('~/utils/metadata'),
			import('~/containers/Cexs/server/routes')
		])
		const cexRoute = resolveCexParamFromMetadata(exchangeName, metadataCache)
		if (!cexRoute) {
			console.warn(`[cex/assets/[cex]] ${exchangeName} not found in protocol metadata cache`)
			return {
				notFound: true
			}
		}
		if (exchangeName !== cexRoute.canonicalSlug) {
			return canonicalRouteRedirect(`/cex/assets/${cexRoute.canonicalSlug}`, true)
		}

		const protocolData = await fetchProtocolOverviewMetrics(cexRoute.canonicalSlug)

		if (!protocolData) {
			console.warn(`[cex/assets/[cex]] ${exchangeName} matched metadata but protocol overview metrics were unavailable`)
			return { notFound: true }
		}

		return {
			props: {
				name: protocolData.name,
				parentProtocol: protocolData.parentProtocol ?? null,
				otherProtocols: protocolData.otherProtocols ?? [],
				category: protocolData.category ?? null,
				metrics: { tvl: Boolean(cexRoute.metadata.tvl), stablecoins: Boolean(cexRoute.metadata.stablecoins) },
				ownToken: cexRoute.cexMetadata?.coin ?? null
			},
			revalidate: maxAgeForNext([22])
		}
	}
)

export const getStaticPaths = () => {
	// When this is true (in preview environments) don't
	// prerender any static pages
	// (faster builds, but slower initial page load)
	if (SKIP_BUILD_STATIC_GENERATION) {
		return {
			paths: [],
			fallback: 'blocking'
		}
	}

	return { paths: [], fallback: 'blocking' }
}

type MultiSeriesCharts = NonNullable<IMultiSeriesChart2Props['charts']>

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
	const [selectedChains, setSelectedChains] = React.useState<string[]>(() => allChains)

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
					chartOptions={{ tooltip: { formatter: AGG_TOOLTIP_FORMATTER_USD } }}
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
	const [selectedTokensUSD, setSelectedTokensUSD] = React.useState<string[]>(() => allTokens)

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
					chartOptions={{ tooltip: { formatter: AGG_TOOLTIP_FORMATTER_USD } }}
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
	const [selectedTokens, setSelectedTokens] = React.useState<string[]>(() => allTokens)

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
	const [selectedTokensRaw, setSelectedTokensRaw] = React.useState<string[]>(() => allTokens)

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
	const allSeries = React.useMemo(() => ['USD Inflows'], [])

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
					selectedCharts={new Set(allSeries)}
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
	const [selectedTokenInflows, setSelectedTokenInflows] = React.useState<string[]>(() => allTokens)

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

export default function Protocols(props: CexAssetsPageProps) {
	const router = useRouter()

	// includeOwnTokens is off by default and only enabled via URL query.
	// Read query params only when router is ready to avoid hydration mismatch.
	const includeOwnTokens = router.isReady && router.query.includeOwnTokens === 'true'
	const protocol = slug(props.name ?? '')
	const extraKeys = React.useMemo(() => {
		if (!includeOwnTokens || !props.ownToken) return []
		return ['OwnTokens']
	}, [includeOwnTokens, props.ownToken])

	const {
		isLoading,
		chainsUnique,
		tokensUnique,
		chainsDataset,
		chainsCharts,
		tokenUSDDataset,
		tokenUSDCharts,
		tokenRawDataset,
		tokenRawCharts,
		tokenBreakdownUSD,
		tokenBreakdownLatest,
		tokenBreakdownLatestKey,
		tokenBreakdownPieChart,
		usdInflowsDataset,
		tokenInflowsDataset,
		tokenInflowsCharts
	} = useProtocolBreakdownCharts({
		protocol,
		keys: extraKeys,
		includeBase: true
	})

	const toggleIncludeOwnTokens = (event: React.ChangeEvent<HTMLInputElement>) => {
		const nextIncludeOwnTokens = event.currentTarget.checked
		void pushShallowQuery(router, { includeOwnTokens: nextIncludeOwnTokens ? 'true' : undefined })
	}
	const hasBreakdownMetrics =
		(chainsDataset && chainsUnique?.length > 1) ||
		(tokenUSDDataset && tokensUnique?.length > 0) ||
		(tokenBreakdownUSD?.length > 1 && tokensUnique?.length > 0 && tokenBreakdownPieChart?.length > 0) ||
		(tokenRawDataset && tokensUnique?.length > 0) ||
		usdInflowsDataset ||
		(tokenInflowsDataset && tokensUnique?.length > 0)

	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics as IProtocolPageMetrics}
			tab="assets"
			isCEX={true}
		>
			<EntityTitleStrip
				className="col-span-full"
				media={<TokenLogo name={props.name} kind="token" size={28} alt={`Logo of ${props.name}`} />}
				title={props.name}
				actions={
					props.ownToken ? (
						<Switch
							value="includeOwnTokens"
							label={`Include own tokens (${props.ownToken})`}
							checked={includeOwnTokens}
							onChange={toggleIncludeOwnTokens}
							className="gap-2"
						/>
					) : null
				}
			/>
			{isLoading ? (
				<PanelLoadingStatus>
					<LocalLoader />
				</PanelLoadingStatus>
			) : !hasBreakdownMetrics ? (
				<PanelStatus className="col-span-full">Breakdown metrics are not available</PanelStatus>
			) : (
				<div className="grid grid-cols-2 gap-2">
					{chainsDataset && chainsUnique?.length > 1 ? (
						<ChainsChartCard
							key={chainsUnique.join('|')}
							protocolName={props.name}
							allChains={chainsUnique}
							dataset={chainsDataset}
							charts={chainsCharts}
						/>
					) : null}

					{tokenUSDDataset && tokensUnique?.length > 0 ? (
						<TokenValuesUSDChartCard
							key={tokensUnique.join('|')}
							protocolName={props.name}
							allTokens={tokensUnique}
							dataset={tokenUSDDataset}
							charts={tokenUSDCharts}
						/>
					) : null}

					{tokenBreakdownUSD?.length > 1 && tokensUnique?.length > 0 && tokenBreakdownPieChart?.length > 0 ? (
						<TokensBreakdownPieChartCard
							key={tokenBreakdownLatestKey}
							tokenBreakdownLatest={tokenBreakdownLatest}
							protocolName={props.name}
						/>
					) : null}

					{tokenRawDataset && tokensUnique?.length > 0 ? (
						<TokenBalancesRawChartCard
							key={tokensUnique.join('|')}
							protocolName={props.name}
							allTokens={tokensUnique}
							dataset={tokenRawDataset}
							charts={tokenRawCharts}
						/>
					) : null}

					{usdInflowsDataset ? <USDInflowsChartCard protocolName={props.name} dataset={usdInflowsDataset} /> : null}

					{tokenInflowsDataset && tokensUnique?.length > 0 ? (
						<InflowsByTokenChartCard
							key={tokensUnique.join('|')}
							protocolName={props.name}
							allTokens={tokensUnique}
							dataset={tokenInflowsDataset}
							charts={tokenInflowsCharts}
						/>
					) : null}
				</div>
			)}
		</ProtocolOverviewLayout>
	)
}

const USD_INFLOWS_CHARTS = [
	{ type: 'bar' as const, name: 'USD Inflows', encode: { x: 'timestamp', y: 'USD Inflows' }, color: oldBlue }
]
