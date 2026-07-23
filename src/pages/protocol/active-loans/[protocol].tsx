import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { buildSelectedSeriesCsv } from '~/components/ECharts/MultiSeriesChart/selection'
import { buildRuntimePieChartPresentation, type RuntimePieChartData } from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { tvlOptionsMap } from '~/components/Filters/options'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TokenLogo } from '~/components/TokenLogo'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import {
	type ProtocolBreakdownChart,
	useProtocolBreakdownCharts
} from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import { useProtocolBreakdownPresentation } from '~/containers/ProtocolOverview/useProtocolBreakdownPresentation'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { TVL_SETTINGS_KEYS_SET } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useAllSeriesSelection } from '~/hooks/useSeriesSelection'
import { ChartPanelToolbar, ChartPanel, ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { slug } from '~/utils'
import { tokenIconUrl } from '~/utils/icons'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

const EMPTY_OTHER_PROTOCOLS: string[] = []

function MultiSeriesChartCard({
	title,
	protocolName,
	allSeries,
	seriesLabel,
	breakdown,
	defaultSeries,
	aggregateOthers,
	exportSuffix,
	valueSymbol,
	exportIconUrl
}: {
	title: string
	protocolName: string
	allSeries: string[]
	seriesLabel: string
	breakdown: ProtocolBreakdownChart
	defaultSeries?: string[]
	aggregateOthers: boolean
	exportSuffix: string
	valueSymbol?: string
	exportIconUrl?: string
}) {
	const {
		activeSeries: selectedSeries,
		setSelectedSeries,
		dataset,
		charts,
		selectedCharts
	} = useProtocolBreakdownPresentation({
		breakdown,
		availableSeries: allSeries,
		defaultSeries,
		aggregateOthers,
		type: 'line'
	})

	const { chartInstance, handleChartReady } = useGetChartInstance()

	const exportFilenameBase = `${slug(protocolName)}-${slug(exportSuffix)}`
	const exportTitle = `${protocolName} ${title}`

	return (
		<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">{title}</h2>
				{allSeries.length > 1 ? (
					<SelectWithCombobox
						allValues={allSeries}
						selectedValues={selectedSeries}
						setSelectedValues={setSelectedSeries}
						label={seriesLabel}
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
							dataset,
							charts,
							selectedCharts,
							filename: exportFilenameBase
						})
					}
				/>
			</ChartPanelToolbar>
			<React.Suspense fallback={<ChartPanelBodyFallback />}>
				<MultiSeriesChart
					dataset={dataset}
					charts={charts}
					{...(valueSymbol !== undefined ? { valueSymbol } : {})}
					selectedCharts={selectedCharts}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</ChartPanel>
	)
}

function TokensBreakdownPieChartCard({
	protocolName,
	series,
	exportIconUrl
}: {
	protocolName: string
	series: RuntimePieChartData
	exportIconUrl?: string
}) {
	const selectableSeries = React.useMemo(() => series.peers.map((peer) => peer.name), [series.peers])
	const {
		activeSeries: selectedTokens,
		selectedCharts,
		setSelectedSeries: setSelectedTokens,
		includeUpstreamOthers
	} = useAllSeriesSelection({ availableSeries: selectableSeries })
	const presentation = React.useMemo(
		() => buildRuntimePieChartPresentation({ series, selectedSeries: selectedCharts, includeUpstreamOthers }),
		[includeUpstreamOthers, selectedCharts, series]
	)

	const { chartInstance, handleChartReady } = useGetChartInstance()

	const exportFilenameBase = `${slug(protocolName)}-active-loans-tokens-breakdown-usd`
	const exportTitle = `${protocolName} Active Loans Tokens Breakdown (USD)`

	return (
		<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">Active Loans Tokens Breakdown (USD)</h2>
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
					iconUrl={exportIconUrl}
				/>
			</ChartPanelToolbar>
			<React.Suspense fallback={<ChartPanelBodyFallback />}>
				<PieChart
					chartData={presentation.chartData}
					stackColors={presentation.stackColors}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</ChartPanel>
	)
}

export const getStaticProps = withPerformanceLogging(
	'protocol/active-loans/[protocol]',
	async ({ params }: GetStaticPropsContext<{ protocol: string }>) => {
		if (!params?.protocol) {
			return { notFound: true }
		}
		const { protocol } = params
		const [{ default: metadataCache }, { resolveProtocolFeatureRouteFromMetadata }] = await Promise.all([
			import('~/utils/metadata'),
			import('~/containers/ProtocolOverview/server/routes')
		])
		const protocolRoute = resolveProtocolFeatureRouteFromMetadata({
			hasMetric: (metadata) => Boolean(metadata.borrowed),
			metadataCache,
			protocol,
			routePrefix: 'protocol/active-loans'
		})
		if (!protocolRoute) {
			return { notFound: true }
		}
		if (protocolRoute.type === 'redirect') {
			return canonicalRouteRedirect(protocolRoute.destination)
		}
		const metadata = protocolRoute.route.metadata
		const canonicalProtocol = protocolRoute.route.canonicalSlug

		const protocolData = await fetchProtocolOverviewMetrics(canonicalProtocol)

		if (!protocolData || protocolData.currentChainTvls?.borrowed == null) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		const metrics = getProtocolMetricFlags({ protocolData, metadata })
		const seoTitle = `${protocolData.name} Active Loans & Lending - DefiLlama`
		const seoDescription = `Monitor ${protocolData.name} active loans, utilization rates, and lending pools on DefiLlama.`

		const toggleOptions = []

		for (const chain in protocolData.currentChainTvls) {
			if (TVL_SETTINGS_KEYS_SET.has(chain)) {
				const option = tvlOptionsMap.get(chain as any)
				if (option) {
					toggleOptions.push(option)
				}
			}
		}

		return {
			props: {
				name: protocolData.name,
				parentProtocol: protocolData.parentProtocol ?? null,
				otherProtocols: protocolData.otherProtocols ?? EMPTY_OTHER_PROTOCOLS,
				category: protocolData.category ?? null,
				metrics,
				warningBanners: getProtocolWarningBanners(protocolData),
				toggleOptions,
				seoTitle,
				seoDescription
			},
			revalidate: maxAgeForNext([22])
		}
	}
)

export const getStaticPaths = () => {
	if (SKIP_BUILD_STATIC_GENERATION) {
		return {
			paths: [],
			fallback: 'blocking'
		}
	}

	return { paths: [], fallback: 'blocking' }
}

export default function ActiveLoansProtocol(props: InferGetStaticPropsType<typeof getStaticProps>) {
	const protocol = slug(props.name ?? '')
	const {
		isLoading,
		chainsUnique,
		tokensUnique,
		rawTokensUnique,
		defaultRawTokens,
		chainBreakdown,
		tokenRawBreakdown,
		tokenBreakdownUSD,
		tokenBreakdownPieSeries
	} = useProtocolBreakdownCharts({
		protocol,
		keys: ['borrowed'],
		includeBase: false,
		inflows: props.metrics?.inflows,
		computeInflows: false
	})
	const hasBreakdownMetrics =
		(chainBreakdown && chainsUnique.length > 1) ||
		(tokenBreakdownUSD && tokensUnique.length > 0) ||
		tokenBreakdownPieSeries.peers.length > 0 ||
		tokenBreakdownPieSeries.upstreamOthersValue > 0 ||
		(tokenRawBreakdown && rawTokensUnique.length > 0)
	const protocolIconUrl = tokenIconUrl(props.name)

	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="borrowed"
			warningBanners={props.warningBanners}
			toggleOptions={props.toggleOptions}
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
		>
			<EntityTitleStrip
				media={<TokenLogo name={props.name} kind="token" size={28} alt={`Logo of ${props.name}`} />}
				title={`${props.name} Active Loans`}
			/>

			{isLoading ? (
				<PanelLoadingStatus label={`Loading ${props.name} active loans`} />
			) : !hasBreakdownMetrics ? (
				<PanelStatus variant="empty" className="col-span-full">
					Breakdown metrics are not available
				</PanelStatus>
			) : (
				<div className="grid grid-cols-2 gap-2">
					{chainBreakdown && chainsUnique.length > 1 ? (
						<MultiSeriesChartCard
							title="Active Loans by Chain"
							protocolName={props.name}
							allSeries={chainsUnique}
							seriesLabel="Chain"
							breakdown={chainBreakdown}
							aggregateOthers
							exportSuffix="active-loans-by-chain"
							valueSymbol="$"
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{tokenBreakdownUSD && tokensUnique.length > 0 ? (
						<MultiSeriesChartCard
							title="Active Loans by Token (USD)"
							protocolName={props.name}
							allSeries={tokensUnique}
							seriesLabel="Token"
							breakdown={tokenBreakdownUSD}
							aggregateOthers
							exportSuffix="active-loans-by-token-usd"
							valueSymbol="$"
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{tokenBreakdownPieSeries.peers.length > 0 || tokenBreakdownPieSeries.upstreamOthersValue > 0 ? (
						<TokensBreakdownPieChartCard
							protocolName={props.name}
							series={tokenBreakdownPieSeries}
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{tokenRawBreakdown && rawTokensUnique.length > 0 ? (
						<MultiSeriesChartCard
							title="Active Loans by Token (Raw Quantities)"
							protocolName={props.name}
							allSeries={rawTokensUnique}
							seriesLabel="Token"
							breakdown={tokenRawBreakdown}
							defaultSeries={defaultRawTokens}
							aggregateOthers={false}
							exportSuffix="active-loans-by-token-raw"
							valueSymbol=""
							exportIconUrl={protocolIconUrl}
						/>
					) : null}
				</div>
			)}
		</ProtocolOverviewLayout>
	)
}
