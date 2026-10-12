import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { BasicLink } from '~/components/Link'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { RWAOverview } from '~/containers/RWA'
import { getRwaPlatformPageOutcome } from '~/containers/RWA/platformRoutes'
import { getRWAAssetsOverview } from '~/containers/RWA/queries'
import { findByRwaSlug } from '~/containers/RWA/rwaSlug'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

export const getStaticProps = withPerformanceLogging(
	'protocol/rwa/[protocol]',
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
			hasMetric: (metadata) => Boolean(metadata.rwaPlatformSlug),
			metadataCache,
			protocol,
			routePrefix: 'protocol/rwa'
		})
		if (!protocolRoute) {
			return { notFound: true }
		}
		if (protocolRoute.type === 'redirect') {
			return canonicalRouteRedirect(protocolRoute.destination)
		}
		const metadata = protocolRoute.route.metadata
		const platformSlug = metadata.rwaPlatformSlug as string

		const [protocolData, rwaOverview] = await Promise.all([
			fetchProtocolOverviewMetrics(protocolRoute.route.canonicalSlug),
			getRWAAssetsOverview({ platform: platformSlug, rwaList: metadataCache.rwaList })
		])

		if (!protocolData || !rwaOverview) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		const platformMeta = metadataCache.rwaPlatformsIndex.platforms[platformSlug] ?? null
		const platformPage = platformMeta ? { meta: platformMeta } : null
		// The tab reads spot assets only; a protocol whose RWA activity is a perps venue points to its venue page.
		const outcome = getRwaPlatformPageOutcome({
			spotRows: rwaOverview.assets.filter((asset) => asset.kind === 'spot').length,
			meta: platformMeta,
			perpsVenue: findByRwaSlug(platformSlug, metadataCache.rwaPerpsList.venues)
		})
		const perpsVenueHref =
			outcome.kind === 'redirect' ? outcome.destination : outcome.kind === 'page' ? outcome.perpsVenueHref : null
		const perpsOnly = outcome.kind === 'redirect'

		return {
			props: {
				rwaOverview: { ...rwaOverview, platformPage, perpsVenueHref },
				perpsOnly,
				name: protocolData.name,
				otherProtocols: protocolData?.otherProtocols ?? [],
				category: protocolData?.category ?? null,
				metrics: getProtocolMetricFlags({ protocolData, metadata }),
				warningBanners: getProtocolWarningBanners(protocolData),
				seoTitle: `${protocolData.name} Real World Assets (RWA) - DefiLlama`,
				seoDescription: `Track ${protocolData.name} tokenized real-world assets: on-chain AUM, asset breakdown, fees and issuer details on DefiLlama.`
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

export default function ProtocolRWA(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="rwa"
			warningBanners={props.warningBanners}
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
		>
			{props.perpsOnly && props.rwaOverview.perpsVenueHref ? (
				<Card padding="sm">
					<p className="body-md">
						{props.name} lists RWA perpetual markets, not spot assets.{' '}
						<Button as={BasicLink} href={props.rwaOverview.perpsVenueHref} variant="inlineLink">
							See its markets on the venue page
						</Button>
						.
					</p>
				</Card>
			) : (
				<RWAOverview {...props.rwaOverview} pageKind="platform" hideEntityNav />
			)}
		</ProtocolOverviewLayout>
	)
}
