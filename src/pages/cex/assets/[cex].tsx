import type { GetStaticPropsContext } from 'next'
import { TokenLogo } from '~/components/TokenLogo'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { IncludeOwnTokensSwitch, ReserveAssetsCharts } from '~/containers/Cexs/ReserveAssetsCharts'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import type { IProtocolPageMetrics } from '~/containers/ProtocolOverview/types'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

interface CexAssetsPageProps {
	name: string
	parentProtocol: string | null
	otherProtocols: Array<string>
	category: string | null
	metrics: Pick<IProtocolPageMetrics, 'tvl' | 'stablecoins'>
	ownToken: string | null
}

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
				metrics: {
					tvl: Boolean(cexRoute.metadata.tvl),
					stablecoins: Boolean(cexRoute.metadata.tvl),
					cryptoCards: Boolean(cexRoute.metadata.cryptoCardIssuer)
				},
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

export default function Protocols(props: CexAssetsPageProps) {
	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics as IProtocolPageMetrics}
			tab="assets"
			isCEX
		>
			<EntityTitleStrip
				className="col-span-full"
				media={<TokenLogo name={props.name} kind="token" size={28} alt={`Logo of ${props.name}`} />}
				title={props.name}
				actions={props.ownToken ? <IncludeOwnTokensSwitch ownToken={props.ownToken} /> : null}
			/>
			<ReserveAssetsCharts protocol={slug(props.name ?? '')} displayName={props.name} ownToken={props.ownToken} />
		</ProtocolOverviewLayout>
	)
}
