import { useQuery } from '@tanstack/react-query'
import type { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import * as React from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TokenLogo } from '~/components/TokenLogo'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import type { IProtocolPageMetrics } from '~/containers/ProtocolOverview/types'
import { useProtocolBreakdownCharts } from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useSelectedValues } from '~/hooks/useSelectedValues'
import { ChartPanelToolbar, ChartPanel, ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { Switch } from '~/ui/Switch'
import { slug } from '~/utils'
import { fetchJson } from '~/utils/async'
import { tokenIconUrl } from '~/utils/icons'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'
import { pushShallowQuery } from '~/utils/routerQuery'

const EMPTY_TOGGLE_OPTIONS = []
const TREASURY_SERIES = new Set(['Treasury'])

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const PieChart = React.lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

type MultiSeriesCharts = NonNullable<IMultiSeriesChartProps['charts']>

interface TreasuryPageProps {
	name: string
	otherProtocols: string[]
	category: string | null
	metrics: IProtocolPageMetrics
	warningBanners: ReturnType<typeof getProtocolWarningBanners>
	seoTitle: string
	seoDescription: string
}

function TokensBreakdownPieChartCard({
	protocolName,
	chartData,
	exportIconUrl
}: {
	protocolName: string
	chartData: Array<{ name: string; value: number }>
	exportIconUrl?: string
}) {
	const allTokens = React.useMemo(() => chartData.map((d) => d.name), [chartData])
	const [selectedTokens, setSelectedTokens] = useSelectedValues(allTokens)

	const selectedTokensSet = React.useMemo(() => new Set(selectedTokens), [selectedTokens])
	const filteredChartData = React.useMemo(() => {
		if (selectedTokens.length === 0) return []
		return chartData.filter((d) => selectedTokensSet.has(d.name))
	}, [chartData, selectedTokens.length, selectedTokensSet])

	const { chartInstance, handleChartReady } = useGetChartInstance()

	const exportFilenameBase = `${slug(protocolName)}-treasury-tokens-breakdown`
	const exportTitle = `${protocolName} Treasury by Token`

	return (
		<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">Tokens Breakdown</h2>
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
					iconUrl={exportIconUrl}
				/>
			</ChartPanelToolbar>
			<React.Suspense fallback={<ChartPanelBodyFallback />}>
				<PieChart chartData={filteredChartData} onReady={handleChartReady} />
			</React.Suspense>
		</ChartPanel>
	)
}

function HistoricalTreasuryChartCard({
	protocolName,
	dataset,
	charts,
	exportIconUrl
}: {
	protocolName: string
	dataset: MultiSeriesChartDataset
	charts: MultiSeriesCharts
	exportIconUrl?: string
}) {
	const { chartInstance, handleChartReady } = useGetChartInstance()

	const exportFilenameBase = `${slug(protocolName)}-historical-treasury`
	const exportTitle = `${protocolName} Historical Treasury`

	return (
		<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">Historical Treasury</h2>
				<ChartExportButtons
					chartInstance={chartInstance}
					filename={exportFilenameBase}
					title={exportTitle}
					iconUrl={exportIconUrl}
				/>
			</ChartPanelToolbar>
			<React.Suspense fallback={<ChartPanelBodyFallback />}>
				<MultiSeriesChart
					dataset={dataset}
					charts={charts}
					valueSymbol="$"
					selectedCharts={TREASURY_SERIES}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</ChartPanel>
	)
}

function TokensMultiSeriesChartCard({
	title,
	protocolName,
	allTokens,
	dataset,
	charts,
	exportSuffix,
	valueSymbol,
	exportIconUrl
}: {
	title: string
	protocolName: string
	allTokens: string[]
	dataset: MultiSeriesChartDataset
	charts: MultiSeriesCharts
	exportSuffix: string
	valueSymbol?: string
	exportIconUrl?: string
}) {
	const [selectedTokens, setSelectedTokens] = useSelectedValues(allTokens)
	const selectedTokensSet = React.useMemo(() => new Set(selectedTokens), [selectedTokens])

	const { chartInstance, handleChartReady } = useGetChartInstance()

	const exportFilenameBase = `${slug(protocolName)}-${slug(exportSuffix)}`
	const exportTitle = `${protocolName} Treasury ${title}`

	return (
		<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
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
				<MultiSeriesChart
					dataset={dataset}
					charts={charts}
					{...(valueSymbol !== undefined ? { valueSymbol } : {})}
					selectedCharts={selectedTokensSet}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</ChartPanel>
	)
}

export const getStaticProps = withPerformanceLogging(
	'protocol/treasury[protocol]',
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
			hasMetric: (metadata) => Boolean(metadata.treasury),
			metadataCache,
			protocol,
			routePrefix: 'protocol/treasury'
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
		const seoTitle = `${protocolData.name} Treasury Holdings & Assets - DefiLlama`
		const seoDescription = `Track ${protocolData.name} treasury holdings, asset composition, and own-token vs stablecoin breakdown on DefiLlama.`

		return {
			props: {
				name: protocolData.name,
				otherProtocols: protocolData?.otherProtocols ?? [],
				category: protocolData?.category ?? null,
				metrics,
				warningBanners: getProtocolWarningBanners(protocolData),
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

export default function Protocols(props: TreasuryPageProps) {
	const router = useRouter()
	const protocol = slug(props.name ?? '')

	// includeOwnTokens is off by default and only enabled via URL query.
	// Read query params only when router is ready to avoid hydration mismatch.
	const includeOwnTokens = router.isReady && router.query.includeOwnTokens === 'true'

	const extraKeys = React.useMemo(() => (includeOwnTokens ? ['OwnTokens'] : []), [includeOwnTokens])

	const {
		isLoading,
		errors,
		valueDataset,
		valueCharts,
		tokensUnique,
		rawTokensUnique,
		tokenUSDDataset,
		tokenUSDCharts,
		tokenRawDataset,
		tokenRawCharts,
		tokenBreakdownPieChart
	} = useProtocolBreakdownCharts({
		protocol,
		keys: extraKeys,
		includeBase: true,
		source: 'treasury',
		inflows: true,
		computeInflows: false
	})

	const { data: ownTokensBreakdown } = useQuery({
		queryKey: ['protocol-overview', 'treasury-own-tokens', protocol],
		queryFn: () =>
			fetchJson(
				`/api/public/protocols/charts?kind=treasury&protocol=${encodeURIComponent(protocol)}&key=${encodeURIComponent('OwnTokens')}&breakdownType=${encodeURIComponent('token-breakdown')}`
			),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: !!protocol
	})

	const hasOwnTokens = (ownTokensBreakdown?.length ?? 0) > 0
	const protocolIconUrl = tokenIconUrl(props.name)

	const toggleIncludeOwnTokens = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const nextIncludeOwnTokens = event.currentTarget.checked
			void pushShallowQuery(router, { includeOwnTokens: nextIncludeOwnTokens ? 'true' : undefined })
		},
		[router]
	)

	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="treasury"
			warningBanners={props.warningBanners}
			toggleOptions={EMPTY_TOGGLE_OPTIONS}
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
		>
			<EntityTitleStrip
				className="col-span-full"
				media={<TokenLogo name={props.name} kind="token" size={28} alt={`Logo of ${props.name}`} />}
				title={`${props.name} Treasury`}
				actions={
					hasOwnTokens ? (
						<Switch
							value="includeOwnTokens"
							label="Include own tokens"
							checked={includeOwnTokens}
							onChange={toggleIncludeOwnTokens}
							className="gap-2"
						/>
					) : null
				}
			/>

			{isLoading ? (
				<PanelLoadingStatus label={`Loading ${props.name} treasury`} />
			) : (
				<div className="grid grid-cols-2 gap-2">
					{tokenBreakdownPieChart?.length ? (
						<TokensBreakdownPieChartCard
							protocolName={props.name}
							chartData={tokenBreakdownPieChart}
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{valueDataset ? (
						<HistoricalTreasuryChartCard
							key="historical-treasury"
							protocolName={props.name}
							dataset={valueDataset}
							charts={valueCharts}
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{tokenRawDataset && rawTokensUnique.length > 0 ? (
						<TokensMultiSeriesChartCard
							title="Tokens Breakdown"
							protocolName={props.name}
							allTokens={rawTokensUnique}
							dataset={tokenRawDataset}
							charts={tokenRawCharts}
							exportSuffix="treasury-tokens-breakdown-raw"
							valueSymbol=""
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{tokenUSDDataset && tokensUnique.length > 0 ? (
						<TokensMultiSeriesChartCard
							title="Tokens (USD)"
							protocolName={props.name}
							allTokens={tokensUnique}
							dataset={tokenUSDDataset}
							charts={tokenUSDCharts}
							exportSuffix="treasury-tokens-usd"
							valueSymbol="$"
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
	tvl: 'historical treasury',
	'chain-breakdown': 'chain breakdown',
	'token-breakdown-usd': 'token breakdown (USD)',
	'token-breakdown-raw': 'token breakdown (raw quantities)'
}
