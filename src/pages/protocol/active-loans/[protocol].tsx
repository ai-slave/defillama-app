import type { GetStaticPropsContext } from 'next'
import * as React from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { getActiveLoansPanel } from '~/containers/ProtocolOverview/activeLoans'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { BreakdownChartCard, TokensBreakdownPieChartCard } from '~/containers/ProtocolOverview/BreakdownCards'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import type { ProtocolExtraTvlKey } from '~/containers/ProtocolOverview/tvlChart'
import type { IProtocolPageMetrics } from '~/containers/ProtocolOverview/types'
import {
	buildLatestBreakdownPieSeries,
	useProtocolBreakdownCharts
} from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { slug } from '~/utils'
import { tokenIconUrl } from '~/utils/icons'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

const EMPTY_OTHER_PROTOCOLS: Array<string> = []
const ACTIVE_LOANS_KEYS: Array<ProtocolExtraTvlKey> = ['borrowed']
const ACTIVE_LOANS_SHARE_HEADER = '% of Active Loans'

interface ActiveLoansProtocolPageProps {
	name: string
	otherProtocols: Array<string>
	category: string | null
	metrics: IProtocolPageMetrics
	warningBanners: ReturnType<typeof getProtocolWarningBanners>
	seoTitle: string
	seoDescription: string
}

export const getStaticProps = withPerformanceLogging<ActiveLoansProtocolPageProps, { protocol: string }>(
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

		if (protocolData.currentChainTvls.borrowed === undefined) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		const metrics = getProtocolMetricFlags({ protocolData, metadata })
		const seoTitle = `${protocolData.name} Active Loans & Lending - DefiLlama`
		const seoDescription = `Monitor ${protocolData.name} active loans, utilization rates, and lending pools on DefiLlama.`

		return {
			props: {
				name: protocolData.name,
				otherProtocols: protocolData.otherProtocols ?? EMPTY_OTHER_PROTOCOLS,
				category: protocolData.category ?? null,
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
	if (SKIP_BUILD_STATIC_GENERATION) {
		return {
			paths: [],
			fallback: 'blocking'
		}
	}

	return { paths: [], fallback: 'blocking' }
}

export default function ActiveLoansProtocol(props: ActiveLoansProtocolPageProps) {
	const protocol = slug(props.name)
	const {
		isLoading,
		errors,
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
		keys: ACTIVE_LOANS_KEYS,
		includeBase: false,
		inflows: props.metrics.inflows,
		computeInflows: false
	})
	// Same minimum as the hook's token pie default, so chain and token tables filter alike.
	const chainBreakdownPieSeries = React.useMemo(
		() => buildLatestBreakdownPieSeries(chainBreakdown, 1),
		[chainBreakdown]
	)
	const panel = getActiveLoansPanel({
		isLoading,
		errorCount: errors.length,
		chainBreakdown,
		chainsUnique,
		tokenBreakdownUSD,
		tokensUnique,
		tokenBreakdownPieSeries,
		tokenRawBreakdown,
		rawTokensUnique
	})
	const protocolIconUrl = tokenIconUrl(props.name)
	const buildFilename = (suffix: string) => `${protocol}-${slug(suffix)}`
	const buildTitle = (suffix: string) => `${props.name} ${suffix}`

	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="borrowed"
			warningBanners={props.warningBanners}
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
		>
			<EntityTitleStrip
				media={<TokenLogo name={props.name} kind="token" size={28} alt={`Logo of ${props.name}`} />}
				title={`${props.name} Active Loans`}
			/>

			{panel === 'loading' ? (
				<PanelLoadingStatus label={`Loading ${props.name} active loans`} />
			) : panel === 'empty' ? (
				<PanelStatus variant="empty" className="col-span-full">
					Breakdown metrics are not available
				</PanelStatus>
			) : panel === 'charts' ? (
				<div className="grid grid-cols-2 gap-2">
					{chainBreakdown && chainsUnique.length > 1 ? (
						<BreakdownChartCard
							title="Active Loans by Chain"
							seriesLabel="Chain"
							allValues={chainsUnique}
							breakdown={chainBreakdown}
							aggregateOthers
							valueSymbol="$"
							showDominance
							snapshot={chainBreakdownPieSeries}
							shareHeader={ACTIVE_LOANS_SHARE_HEADER}
							exportFilenameBase={buildFilename('active-loans-by-chain')}
							exportTitle={buildTitle('Active Loans by Chain')}
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{tokenBreakdownUSD && tokensUnique.length > 0 ? (
						<BreakdownChartCard
							title="Active Loans by Token (USD)"
							seriesLabel="Token"
							allValues={tokensUnique}
							breakdown={tokenBreakdownUSD}
							aggregateOthers
							valueSymbol="$"
							showDominance
							exportFilenameBase={buildFilename('active-loans-by-token-usd')}
							exportTitle={buildTitle('Active Loans by Token (USD)')}
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{tokenBreakdownPieSeries.peers.length > 0 || tokenBreakdownPieSeries.upstreamOthersValue > 0 ? (
						<TokensBreakdownPieChartCard
							title="Active Loans Tokens Breakdown (USD)"
							tokenBreakdownPieSeries={tokenBreakdownPieSeries}
							shareHeader={ACTIVE_LOANS_SHARE_HEADER}
							exportFilenameBase={buildFilename('active-loans-tokens-breakdown-usd')}
							exportTitle={buildTitle('Active Loans Tokens Breakdown (USD)')}
							exportIconUrl={protocolIconUrl}
						/>
					) : null}

					{tokenRawBreakdown && rawTokensUnique.length > 0 ? (
						<BreakdownChartCard
							title="Active Loans by Token (Raw Quantities)"
							seriesLabel="Token"
							allValues={rawTokensUnique}
							breakdown={tokenRawBreakdown}
							defaultValues={defaultRawTokens}
							aggregateOthers={false}
							valueSymbol=""
							exportFilenameBase={buildFilename('active-loans-by-token-raw')}
							exportTitle={buildTitle('Active Loans by Token (Raw Quantities)')}
							exportIconUrl={protocolIconUrl}
						/>
					) : null}
				</div>
			) : null}
			{errors.length > 0 ? (
				<PanelStatus variant="error" className="col-span-full">
					Couldn&apos;t load the active loans breakdown.
				</PanelStatus>
			) : null}
		</ProtocolOverviewLayout>
	)
}
