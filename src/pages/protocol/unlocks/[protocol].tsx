import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { UnlocksCharts } from '~/containers/Unlocks/EmissionsByProtocol'
import { getProtocolUnlocksStaticPropsData } from '~/containers/Unlocks/protocolUnlocksStaticProps'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

export const getStaticProps = withPerformanceLogging(
	'protocol/unlocks/[protocol]',
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
			hasMetric: (metadata) => Boolean(metadata.emissions),
			metadataCache,
			protocol,
			routePrefix: 'protocol/unlocks'
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

		const metrics = getProtocolMetricFlags({ protocolData, metadata })
		const { emissions, tokenSymbol, initialTokenMarketData, generatedAtSec } = await getProtocolUnlocksStaticPropsData(
			canonicalProtocol,
			metadataCache.tokenlist,
			metadataCache.emissionsProtocolsList
		)
		if (!emissions) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}
		const seoTitle = `${protocolData.name} Token Unlocks & Vesting - DefiLlama`
		const seoDescription = `Track ${protocolData.name}${tokenSymbol ? ` (${tokenSymbol})` : ''} token unlock schedule, vesting timelines, and upcoming emission events on DefiLlama.`

		return {
			props: {
				name: protocolData.name,
				otherProtocols: protocolData?.otherProtocols ?? [],
				category: protocolData?.category ?? null,
				metrics,
				warningBanners: getProtocolWarningBanners(protocolData),
				emissions,
				initialTokenMarketData,
				generatedAtSec,
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

export default function Protocols(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="unlocks"
			warningBanners={props.warningBanners}
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
		>
			<div className="flex flex-col gap-2 rounded-md">
				<UnlocksCharts
					protocolName={props.name}
					initialData={props.emissions}
					initialTokenMarketData={props.initialTokenMarketData}
					generatedAtSec={props.generatedAtSec}
					disableClientTokenStatsFetch
					isEmissionsPage
				/>
			</div>
		</ProtocolOverviewLayout>
	)
}
