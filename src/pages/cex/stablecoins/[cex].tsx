import type { GetStaticPropsContext } from 'next'
import { TokenLogo } from '~/components/TokenLogo'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { ReserveStablecoinCharts } from '~/containers/Cexs/ReserveStablecoinCharts'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import type { IProtocolPageMetrics } from '~/containers/ProtocolOverview/types'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

const EMPTY_OTHER_PROTOCOLS: Array<string> = []

export const getStaticProps = withPerformanceLogging(
	'cex/stablecoins/[cex]',
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
			return {
				notFound: true
			}
		}
		if (exchangeName !== cexRoute.canonicalSlug) {
			return canonicalRouteRedirect(`/cex/stablecoins/${cexRoute.canonicalSlug}`, true)
		}

		const protocolData = await fetchProtocolOverviewMetrics(cexRoute.canonicalSlug)

		if (!protocolData) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		return {
			props: {
				name: protocolData.name,
				otherProtocols: protocolData.otherProtocols ?? EMPTY_OTHER_PROTOCOLS,
				category: protocolData.category ?? null,
				metrics: {
					stablecoins: Boolean(cexRoute.metadata.tvl),
					tvl: Boolean(cexRoute.metadata.tvl),
					cryptoCards: Boolean(cexRoute.metadata.cryptoCardIssuer),
					dexs: false,
					perps: false,
					openInterest: false,
					optionsPremiumVolume: false,
					optionsNotionalVolume: false,
					dexAggregators: false,
					perpsAggregators: false,
					bridgeAggregators: false,
					bridge: false,
					treasury: false,
					unlocks: false,
					incentives: false,
					yields: false,
					fees: false,
					revenue: false,
					forks: false,
					dev: false,
					inflows: false,
					liquidity: false,
					activeUsers: false
				}
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

export default function CEXStablecoins(props: {
	name: string
	category: string | null
	otherProtocols: Array<string>
	metrics: IProtocolPageMetrics
}) {
	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="stablecoins"
			isCEX
		>
			<EntityTitleStrip
				media={<TokenLogo name={props.name} kind="token" size={28} alt={`Logo of ${props.name}`} />}
				title={props.name}
			/>
			<ReserveStablecoinCharts protocol={props.name} displayName={props.name} />
		</ProtocolOverviewLayout>
	)
}
