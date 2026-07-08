import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ButtonStyled/ChartExportButtons'
import { createAggregateTooltipFormatter, createInflowsTooltipFormatter } from '~/components/ECharts/formatters'
import type { IMultiSeriesChart2Props, IPieChartProps, MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import { preparePieChartData } from '~/components/ECharts/utils'
import { tvlOptionsMap } from '~/components/Filters/options'
import { LocalLoader } from '~/components/Loaders'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TokenLogo } from '~/components/TokenLogo'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { oldBlue } from '~/constants/colors'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import { useProtocolBreakdownCharts } from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { TVL_SETTINGS_KEYS_SET, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { Panel } from '~/ui/Panel'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { ChartPanelToolbar } from '~/ui/Toolbar'
import { slug } from '~/utils'
import { tokenIconUrl } from '~/utils/icons'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

const MultiSeriesChart2 = React.lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

const EMPTY_OTHER_PROTOCOLS: string[] = []

const INFLOWS_TOOLTIP_FORMATTER_USD = createInflowsTooltipFormatter({ groupBy: 'daily', valueSymbol: '$' })
const AGG_TOOLTIP_FORMATTER_USD = createAggregateTooltipFormatter({ groupBy: 'daily', valueSymbol: '$' })

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
			return { notFound: true }
		}

		const metrics = getProtocolMetricFlags({ protocolData, metadata })
		const seoTitle = `${protocolData.name} Total Value Locked (TVL) - DefiLlama`
		const seoDescription = `Track ${protocolData.name} Total Value Locked across all chains with historical charts and breakdowns on DefiLlama.`

		const toggleOptions = []
		const chainsUnique = new Set<string>()

		for (const chain in protocolData.currentChainTvls) {
			if (TVL_SETTINGS_KEYS_SET.has(chain)) {
				const option = tvlOptionsMap.get(chain as any)
				if (option) {
					toggleOptions.push(option)
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
				otherProtocols: protocolData.otherProtocols ?? EMPTY_OTHER_PROTOCOLS,
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

type MultiSeriesCharts = NonNullable<IMultiSeriesChart2Props['charts']>

function ChainsChartCard({
	title,
	allValues,
	dataset,
	charts,
	exportFilenameBase,
	exportTitle,
	exportIconUrl
}: {
	title: string
	allValues: string[]
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesCharts
	exportFilenameBase: string
	exportTitle: string
	exportIconUrl?: string
}) {
	const [selected, setSelected] = React.useState<string[]>(() => allValues)

	const selectedChartsSet = React.useMemo(() => new Set(selected), [selected])

	const { chartInstance, handleChartReady } = useGetChartInstance()
	const deferredDataset = React.useDeferredValue(dataset)
	const deferredCharts = React.useDeferredValue(charts)

	return (
		<Panel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">{title}</h2>
				{allValues.length > 1 ? (
					<SelectWithCombobox
						allValues={allValues}
						selectedValues={selected}
						setSelectedValues={setSelected}
						label="Chain"
						labelType="smol"
						variant="filter"
						size="md"
						portal
					/>
				) : null}
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={exportFilenameBase}
					title={exportTitle}
					iconUrl={exportIconUrl}
				/>
			</ChartPanelToolbar>
			<React.Suspense fallback={<div className="min-h-[360px]" />}>
				<MultiSeriesChart2
					dataset={deferredDataset}
					charts={deferredCharts}
					valueSymbol="$"
					selectedCharts={selectedChartsSet}
					chartOptions={{ tooltip: { formatter: AGG_TOOLTIP_FORMATTER_USD } }}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</Panel>
	)
}

function TokenLineChartCard({
	title,
	allValues,
	dataset,
	charts,
	valueSymbol,
	exportFilenameBase,
	exportTitle,
	exportIconUrl
}: {
	title: string
	allValues: string[]
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesCharts
	valueSymbol?: string
	exportFilenameBase: string
	exportTitle: string
	exportIconUrl?: string
}) {
	const [selected, setSelected] = React.useState<string[]>(() => allValues)

	const selectedChartsSet = React.useMemo(() => new Set(selected), [selected])

	const { chartInstance, handleChartReady } = useGetChartInstance()
	const deferredDataset = React.useDeferredValue(dataset)
	const deferredCharts = React.useDeferredValue(charts)

	return (
		<Panel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">{title}</h2>
				{allValues.length > 1 ? (
					<SelectWithCombobox
						allValues={allValues}
						selectedValues={selected}
						setSelectedValues={setSelected}
						label="Token"
						labelType="smol"
						variant="filter"
						size="md"
						portal
					/>
				) : null}
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={exportFilenameBase}
					title={exportTitle}
					iconUrl={exportIconUrl}
				/>
			</ChartPanelToolbar>
			<React.Suspense fallback={<div className="min-h-[360px]" />}>
				<MultiSeriesChart2
					dataset={deferredDataset}
					charts={deferredCharts}
					valueSymbol={valueSymbol}
					selectedCharts={selectedChartsSet}
					chartOptions={valueSymbol === '$' ? { tooltip: { formatter: AGG_TOOLTIP_FORMATTER_USD } } : undefined}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</Panel>
	)
}

function TokensBreakdownPieChartCard({
	title,
	tokenBreakdownLatest,
	exportFilenameBase,
	exportTitle,
	exportIconUrl
}: {
	title: string
	tokenBreakdownLatest: Record<string, number>
	exportFilenameBase: string
	exportTitle: string
	exportIconUrl?: string
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
	const deferredChartData = React.useDeferredValue(chartData)

	const { chartInstance, handleChartReady } = useGetChartInstance()

	return (
		<Panel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">{title}</h2>
				{allTokens.length > 1 ? (
					<SelectWithCombobox
						allValues={allTokens}
						selectedValues={selectedTokens}
						setSelectedValues={setSelectedTokens}
						label="Token"
						labelType="smol"
						variant="filter"
						size="md"
						portal
					/>
				) : null}
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={exportFilenameBase}
					title={exportTitle}
					iconUrl={exportIconUrl}
				/>
			</ChartPanelToolbar>
			<React.Suspense fallback={<div className="min-h-[360px]" />}>
				<PieChart chartData={deferredChartData} onReady={handleChartReady} />
			</React.Suspense>
		</Panel>
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
	dataset: MultiSeriesChart2Dataset
	exportFilenameBase: string
	exportTitle: string
	exportIconUrl?: string
}) {
	const allSeries = React.useMemo(() => ['USD Inflows'], [])

	const { chartInstance, handleChartReady } = useGetChartInstance()
	const deferredDataset = React.useDeferredValue(dataset)

	return (
		<Panel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">{title}</h2>
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={exportFilenameBase}
					title={exportTitle}
					iconUrl={exportIconUrl}
				/>
			</ChartPanelToolbar>
			<React.Suspense fallback={<div className="min-h-[360px]" />}>
				<MultiSeriesChart2
					dataset={deferredDataset}
					charts={USD_INFLOWS_CHARTS}
					valueSymbol="$"
					selectedCharts={new Set(allSeries)}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</Panel>
	)
}

function InflowsByTokenChartCard({
	title,
	allValues,
	dataset,
	charts,
	exportFilenameBase,
	exportTitle,
	exportIconUrl
}: {
	title: string
	allValues: string[]
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesCharts
	exportFilenameBase: string
	exportTitle: string
	exportIconUrl?: string
}) {
	const [selected, setSelected] = React.useState<string[]>(allValues)

	const selectedChartsSet = React.useMemo(() => new Set(selected), [selected])

	const { chartInstance, handleChartReady } = useGetChartInstance()
	const deferredDataset = React.useDeferredValue(dataset)
	const deferredCharts = React.useDeferredValue(charts)

	return (
		<Panel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">{title}</h2>
				{allValues.length > 1 ? (
					<SelectWithCombobox
						allValues={allValues}
						selectedValues={selected}
						setSelectedValues={setSelected}
						label="Token"
						labelType="smol"
						variant="filter"
						size="md"
						portal
					/>
				) : null}
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={exportFilenameBase}
					title={exportTitle}
					iconUrl={exportIconUrl}
				/>
			</ChartPanelToolbar>
			<React.Suspense fallback={<div className="min-h-[360px]" />}>
				<MultiSeriesChart2
					dataset={deferredDataset}
					charts={deferredCharts}
					hideDefaultLegend={true}
					valueSymbol="$"
					selectedCharts={selectedChartsSet}
					chartOptions={
						selectedChartsSet.size > 1 ? { tooltip: { formatter: INFLOWS_TOOLTIP_FORMATTER_USD } } : undefined
					}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</Panel>
	)
}

export default function Protocols(props: InferGetStaticPropsType<typeof getStaticProps>) {
	const [tvlSettings] = useLocalStorageSettingsManager('tvl')
	const protocol = slug(props.name ?? '')
	const toggledTvlKeys = React.useMemo(() => {
		const availableTvlKeys: string[] = (props.toggleOptions ?? []).map((option) => option.key)
		return availableTvlKeys.filter((key) => tvlSettings[key])
	}, [props.toggleOptions, tvlSettings])

	const {
		isLoading,
		errors,
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
		keys: toggledTvlKeys,
		includeBase: true,
		chainsUnique: props.chainsUnique,
		inflows: props.metrics?.inflows
	})

	const protocolSlug = slug(props.name || 'protocol')
	const buildFilename = (suffix: string) => `${protocolSlug}-${slug(suffix)}`
	const buildTitle = (suffix: string) => (props.name ? `${props.name} – ${suffix}` : suffix)
	const protocolIconUrl = props.name ? tokenIconUrl(props.name) : undefined

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
				<PanelLoadingStatus label={`Loading ${props.name} TVL breakdown`}>
					<LocalLoader />
				</PanelLoadingStatus>
			) : props.chainsUnique.length <= 1 && !props.metrics.inflows ? (
				<PanelStatus className="col-span-full">
					Breakdown charts are not available for this protocol as it operates on a single chain and token composition
					data is not accurately trackable.
				</PanelStatus>
			) : (
				<div className="grid grid-cols-2 gap-2">
					{chainsDataset && chainsUnique?.length > 1 ? (
						<ChainsChartCard
							key={chainsUnique.join('|')}
							title="TVL by Chain"
							allValues={chainsUnique}
							dataset={chainsDataset}
							charts={chainsCharts}
							exportFilenameBase={buildFilename('chains')}
							exportTitle={buildTitle('TVL by Chain')}
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{tokenUSDDataset && tokensUnique?.length > 0 ? (
						<TokenLineChartCard
							key={tokensUnique.join('|')}
							title="Token Values (USD)"
							allValues={tokensUnique}
							dataset={tokenUSDDataset}
							charts={tokenUSDCharts}
							valueSymbol="$"
							exportFilenameBase={buildFilename('token-values-usd')}
							exportTitle={buildTitle('TVL by Token (USD)')}
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{tokenBreakdownUSD?.length > 1 && tokensUnique?.length > 0 && tokenBreakdownPieChart?.length > 0 ? (
						<TokensBreakdownPieChartCard
							key={tokenBreakdownLatestKey}
							title="Tokens Breakdown (USD)"
							tokenBreakdownLatest={tokenBreakdownLatest}
							exportFilenameBase={buildFilename('tokens-breakdown-usd')}
							exportTitle={buildTitle('TVL by Token (USD)')}
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{tokenRawDataset && tokensUnique?.length > 0 ? (
						<TokenLineChartCard
							key={`${tokensUnique.join('|')}:raw`}
							title="Token Balances (Raw Quantities)"
							allValues={tokensUnique}
							dataset={tokenRawDataset}
							charts={tokenRawCharts}
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

					{tokenInflowsDataset && tokensUnique?.length > 0 ? (
						<InflowsByTokenChartCard
							key={tokensUnique.join('|')}
							title="Inflows by Token"
							allValues={tokensUnique}
							dataset={tokenInflowsDataset}
							charts={tokenInflowsCharts}
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

const CHART_CATEGORY_LABELS: Record<string, string> = {
	tvl: 'TVL',
	'chain-breakdown': 'chain breakdown',
	'token-breakdown-usd': 'token breakdown',
	'token-breakdown-raw': 'token inflows'
}

const USD_INFLOWS_CHARTS = [
	{ type: 'bar' as const, name: 'USD Inflows', encode: { x: 'timestamp', y: 'USD Inflows' }, color: oldBlue }
]
