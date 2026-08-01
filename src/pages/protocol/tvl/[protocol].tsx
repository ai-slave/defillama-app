import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { buildSelectedSeriesCsv } from '~/components/ECharts/MultiSeriesChart/selection'
import { createInflowsTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/tooltip'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { buildRuntimePieChartPresentation, type RuntimePieChartData } from '~/components/ECharts/PieChart/data'
import { tvlOptionsMap } from '~/components/Filters/options'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TokenLogo } from '~/components/TokenLogo'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { oldBlue } from '~/constants/colors'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import { isProtocolExtraTvlKey, type ProtocolExtraTvlKey } from '~/containers/ProtocolOverview/tvlChart'
import {
	type FailedQueryCategory,
	type ProtocolBreakdownChart,
	useProtocolBreakdownCharts
} from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import { useProtocolBreakdownPresentation } from '~/containers/ProtocolOverview/useProtocolBreakdownPresentation'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { isTvlSettingsKey, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
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

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart'))

const INFLOWS_TOOLTIP_FORMATTER_USD = createInflowsTooltipFormatter({ groupBy: 'daily', valueSymbol: '$' })
const USD_INFLOWS_SERIES = new Set(['USD Inflows'])

export const getStaticProps = withPerformanceLogging(
	'protocol/tvl/[protocol]',
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
			cexRoutePrefix: 'cex/assets',
			hasMetric: (metadata) => Boolean(metadata.tvl),
			metadataCache,
			protocol,
			routePrefix: 'protocol/tvl'
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

		if (!protocolData) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		const metrics = getProtocolMetricFlags({ protocolData, metadata })
		const seoTitle = `${protocolData.name} Total Value Locked (TVL) - DefiLlama`
		const seoDescription = `Track ${protocolData.name} Total Value Locked across all chains with historical charts and breakdowns on DefiLlama.`

		const toggleOptions = []
		const chainsUnique = new Set<string>()

		for (const chain in protocolData.currentChainTvls) {
			if (isTvlSettingsKey(chain)) {
				if (isProtocolExtraTvlKey(chain)) {
					const option = tvlOptionsMap.get(chain)
					if (option) toggleOptions.push({ name: option.name, key: chain })
				}
			} else {
				if (chain.includes('-')) continue
				chainsUnique.add(chain)
			}
		}

		return {
			props: {
				name: protocolData.name,
				parentProtocol: protocolData.parentProtocol ?? null,
				otherProtocols: protocolData.otherProtocols ?? null,
				category: protocolData.category ?? null,
				metrics,
				warningBanners: getProtocolWarningBanners(protocolData),
				toggleOptions,
				chainsUnique: Array.from(chainsUnique),
				seoTitle,
				seoDescription
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

function ChainsChartCard({
	title,
	allValues,
	breakdown,
	exportFilenameBase,
	exportTitle,
	exportIconUrl
}: {
	title: string
	allValues: string[]
	breakdown: ProtocolBreakdownChart
	exportFilenameBase: string
	exportTitle: string
	exportIconUrl: string | undefined
}) {
	const { activeSeries, setSelectedSeries, dataset, charts, selectedCharts } = useProtocolBreakdownPresentation({
		breakdown,
		availableSeries: allValues,
		aggregateOthers: true,
		type: 'line'
	})

	const { chartInstance, handleChartReady } = useGetChartInstance()
	const deferredDataset = React.useDeferredValue(dataset)
	const deferredCharts = React.useDeferredValue(charts)

	return (
		<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">{title}</h2>
				{allValues.length > 1 ? (
					<SelectWithCombobox
						allValues={allValues}
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
					filename={exportFilenameBase}
					title={exportTitle}
					iconUrl={exportIconUrl}
					prepareCsvDirect={() =>
						buildSelectedSeriesCsv({
							dataset: deferredDataset,
							charts: deferredCharts,
							selectedCharts,
							filename: exportFilenameBase
						})
					}
				/>
			</ChartPanelToolbar>
			<React.Suspense fallback={<ChartPanelBodyFallback />}>
				<MultiSeriesChart
					dataset={deferredDataset}
					charts={deferredCharts}
					hideDefaultLegend={false}
					valueSymbol="$"
					selectedCharts={selectedCharts}
					showTotalInTooltip
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</ChartPanel>
	)
}

function TokenLineChartCard({
	title,
	allValues,
	breakdown,
	defaultValues,
	aggregateOthers,
	valueSymbol,
	exportFilenameBase,
	exportTitle,
	exportIconUrl
}: {
	title: string
	allValues: string[]
	breakdown: ProtocolBreakdownChart
	defaultValues?: string[]
	aggregateOthers: boolean
	valueSymbol: string
	exportFilenameBase: string
	exportTitle: string
	exportIconUrl: string | undefined
}) {
	const { activeSeries, setSelectedSeries, dataset, charts, selectedCharts } = useProtocolBreakdownPresentation({
		breakdown,
		availableSeries: allValues,
		...(defaultValues ? { defaultSeries: defaultValues } : {}),
		aggregateOthers,
		type: 'line'
	})

	const { chartInstance, handleChartReady } = useGetChartInstance()
	const deferredDataset = React.useDeferredValue(dataset)
	const deferredCharts = React.useDeferredValue(charts)

	return (
		<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">{title}</h2>
				{allValues.length > 1 ? (
					<SelectWithCombobox
						allValues={allValues}
						selectedValues={activeSeries}
						setSelectedValues={setSelectedSeries}
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
					prepareCsvDirect={() =>
						buildSelectedSeriesCsv({
							dataset: deferredDataset,
							charts: deferredCharts,
							selectedCharts,
							filename: exportFilenameBase
						})
					}
				/>
			</ChartPanelToolbar>
			<React.Suspense fallback={<ChartPanelBodyFallback />}>
				<MultiSeriesChart
					dataset={deferredDataset}
					charts={deferredCharts}
					hideDefaultLegend={false}
					valueSymbol={valueSymbol}
					selectedCharts={selectedCharts}
					showTotalInTooltip={valueSymbol === '$'}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</ChartPanel>
	)
}

function TokensBreakdownPieChartCard({
	title,
	tokenBreakdownPieSeries,
	exportFilenameBase,
	exportTitle,
	exportIconUrl
}: {
	title: string
	tokenBreakdownPieSeries: RuntimePieChartData
	exportFilenameBase: string
	exportTitle: string
	exportIconUrl: string | undefined
}) {
	const selectableSeries = React.useMemo(
		() => tokenBreakdownPieSeries.peers.map((peer) => peer.name),
		[tokenBreakdownPieSeries.peers]
	)
	const {
		activeSeries: selectedTokens,
		selectedCharts,
		setSelectedSeries: setSelectedTokens,
		includeUpstreamOthers
	} = useAllSeriesSelection({ availableSeries: selectableSeries })
	const presentation = React.useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: tokenBreakdownPieSeries,
				selectedSeries: selectedCharts,
				includeUpstreamOthers
			}),
		[includeUpstreamOthers, selectedCharts, tokenBreakdownPieSeries]
	)
	const deferredPresentation = React.useDeferredValue(presentation)

	const { chartInstance, handleChartReady } = useGetChartInstance()

	return (
		<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">{title}</h2>
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
					chartData={deferredPresentation.chartData}
					stackColors={deferredPresentation.stackColors}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</ChartPanel>
	)
}

function USDInflowsChartCard({
	title,
	dataset,
	exportFilenameBase,
	exportTitle,
	exportIconUrl
}: {
	title: string
	dataset: MultiSeriesChartDataset
	exportFilenameBase: string
	exportTitle: string
	exportIconUrl: string | undefined
}) {
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const deferredDataset = React.useDeferredValue(dataset)

	return (
		<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">{title}</h2>
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={exportFilenameBase}
					title={exportTitle}
					iconUrl={exportIconUrl}
				/>
			</ChartPanelToolbar>
			<React.Suspense fallback={<ChartPanelBodyFallback />}>
				<MultiSeriesChart
					dataset={deferredDataset}
					charts={USD_INFLOWS_CHARTS}
					valueSymbol="$"
					selectedCharts={USD_INFLOWS_SERIES}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</ChartPanel>
	)
}

function InflowsByTokenChartCard({
	title,
	allValues,
	breakdown,
	exportFilenameBase,
	exportTitle,
	exportIconUrl
}: {
	title: string
	allValues: string[]
	breakdown: ProtocolBreakdownChart
	exportFilenameBase: string
	exportTitle: string
	exportIconUrl: string | undefined
}) {
	const { activeSeries, setSelectedSeries, dataset, charts, selectedCharts } = useProtocolBreakdownPresentation({
		breakdown,
		availableSeries: allValues,
		aggregateOthers: true,
		type: 'bar',
		stack: 'tokenInflows'
	})

	const { chartInstance, handleChartReady } = useGetChartInstance()
	const deferredDataset = React.useDeferredValue(dataset)
	const deferredCharts = React.useDeferredValue(charts)

	return (
		<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">{title}</h2>
				{allValues.length > 1 ? (
					<SelectWithCombobox
						allValues={allValues}
						selectedValues={activeSeries}
						setSelectedValues={setSelectedSeries}
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
					prepareCsvDirect={() =>
						buildSelectedSeriesCsv({
							dataset: deferredDataset,
							charts: deferredCharts,
							selectedCharts,
							filename: exportFilenameBase
						})
					}
				/>
			</ChartPanelToolbar>
			<React.Suspense fallback={<ChartPanelBodyFallback />}>
				<MultiSeriesChart
					dataset={deferredDataset}
					charts={deferredCharts}
					hideDefaultLegend={false}
					valueSymbol="$"
					selectedCharts={selectedCharts}
					{...(selectedCharts.size > 1
						? { chartOptions: { tooltip: { formatter: INFLOWS_TOOLTIP_FORMATTER_USD } } }
						: {})}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</ChartPanel>
	)
}

export default function Protocols(props: InferGetStaticPropsType<typeof getStaticProps>) {
	const [tvlSettings] = useLocalStorageSettingsManager('tvl')
	const protocol = slug(props.name)
	const toggledTvlKeys = React.useMemo(() => {
		const enabled: ProtocolExtraTvlKey[] = []
		for (const option of props.toggleOptions) {
			if (tvlSettings[option.key]) enabled.push(option.key)
		}
		return enabled
	}, [props.toggleOptions, tvlSettings])

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
		keys: toggledTvlKeys,
		includeBase: true,
		chainsUnique: props.chainsUnique,
		inflows: props.metrics.inflows,
		tokenPieMinimumValue: 0
	})

	const protocolSlug = slug(props.name)
	const buildFilename = (suffix: string) => `${protocolSlug}-${slug(suffix)}`
	const buildTitle = (suffix: string) => `${props.name} – ${suffix}`
	const protocolIconUrl = tokenIconUrl(props.name)

	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="tvl"
			warningBanners={props.warningBanners}
			toggleOptions={props.toggleOptions}
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
		>
			<EntityTitleStrip
				media={<TokenLogo name={props.name} kind="token" size={28} alt={`Logo of ${props.name}`} />}
				title={`${props.name} TVL Breakdown`}
			/>

			{isLoading ? (
				<PanelLoadingStatus label={`Loading ${props.name} TVL breakdown`} />
			) : props.chainsUnique.length <= 1 && !props.metrics.inflows ? (
				<PanelStatus variant="empty" className="col-span-full">
					Breakdown charts are not available for this protocol as it operates on a single chain and token composition
					data is not accurately trackable.
				</PanelStatus>
			) : (
				<div className="grid grid-cols-2 gap-2">
					{chainBreakdown && chainsUnique.length > 1 ? (
						<ChainsChartCard
							title="TVL by Chain"
							allValues={chainsUnique}
							breakdown={chainBreakdown}
							exportFilenameBase={buildFilename('chains')}
							exportTitle={buildTitle('TVL by Chain')}
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{tokenBreakdownUSD && tokensUnique.length > 0 ? (
						<TokenLineChartCard
							title="Token Values (USD)"
							allValues={tokensUnique}
							breakdown={tokenBreakdownUSD}
							aggregateOthers
							valueSymbol="$"
							exportFilenameBase={buildFilename('token-values-usd')}
							exportTitle={buildTitle('TVL by Token (USD)')}
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{tokenBreakdownUSD &&
					tokenBreakdownUSD.length > 1 &&
					tokensUnique.length > 0 &&
					(tokenBreakdownPieSeries.peers.length > 0 || tokenBreakdownPieSeries.upstreamOthersValue > 0) ? (
						<TokensBreakdownPieChartCard
							title="Tokens Breakdown (USD)"
							tokenBreakdownPieSeries={tokenBreakdownPieSeries}
							exportFilenameBase={buildFilename('tokens-breakdown-usd')}
							exportTitle={buildTitle('TVL by Token (USD)')}
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{tokenRawBreakdown && rawTokensUnique.length > 0 ? (
						<TokenLineChartCard
							title="Token Balances (Raw Quantities)"
							allValues={rawTokensUnique}
							breakdown={tokenRawBreakdown}
							defaultValues={defaultRawTokens}
							aggregateOthers={false}
							valueSymbol=""
							exportFilenameBase={buildFilename('token-balances')}
							exportTitle={buildTitle('Token Balances')}
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{usdInflowsDataset ? (
						<USDInflowsChartCard
							title="USD Inflows"
							dataset={usdInflowsDataset}
							exportFilenameBase={buildFilename('usd-inflows')}
							exportTitle={props.name}
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{tokenInflows && inflowTokensUnique.length > 0 ? (
						<InflowsByTokenChartCard
							title="Inflows by Token"
							allValues={inflowTokensUnique}
							breakdown={tokenInflows}
							exportFilenameBase={buildFilename('inflows-by-token')}
							exportTitle={buildTitle('Inflows')}
							exportIconUrl={protocolIconUrl}
						/>
					) : null}
				</div>
			)}
			{errors.length > 0 ? (
				<PanelStatus variant="error" className="col-span-full">
					Failed to fetch{' '}
					{Array.from(new Set(errors.map((e) => CHART_CATEGORY_LABELS[e.category])))
						.filter(Boolean)
						.join(', ')}{' '}
					APIs
				</PanelStatus>
			) : null}
		</ProtocolOverviewLayout>
	)
}

const CHART_CATEGORY_LABELS: Record<FailedQueryCategory, string> = {
	tvl: 'TVL',
	'chain-breakdown': 'chain breakdown',
	'token-breakdown-usd': 'token breakdown',
	'token-breakdown-raw': 'token inflows'
}

const USD_INFLOWS_CHARTS = [
	{ type: 'bar', name: 'USD Inflows', encode: { x: 'timestamp', y: 'USD Inflows' }, color: oldBlue }
] satisfies MultiSeriesChartSeriesConfig[]
