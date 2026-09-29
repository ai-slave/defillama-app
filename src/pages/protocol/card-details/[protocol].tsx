import type { GetStaticPropsContext } from 'next'
import { CryptoCardDetailsPage } from '~/containers/CryptoCards/CardDetails'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

export const getStaticProps = withPerformanceLogging(
	'protocol/card-details/[protocol]',
	async ({ params }: GetStaticPropsContext<{ protocol: string }>) => {
		if (!params?.protocol) return { notFound: true }

		const { protocol } = params
		const [
			{ default: metadataCache },
			{ resolveProtocolFeatureRouteFromMetadata, resolveProtocolParamFromMetadata },
			{ getCryptoCardDetailsPageProps }
		] = await Promise.all([
			import('~/utils/metadata'),
			import('~/containers/ProtocolOverview/server/routes'),
			import('~/containers/CryptoCards/server/detailsPage')
		])
		const resolution = resolveProtocolFeatureRouteFromMetadata({
			cexRoutePrefix: 'cex/card-details',
			hasMetric: (metadata) => Boolean(metadata.cryptoCardIssuer),
			metadataCache,
			protocol,
			routePrefix: 'protocol/card-details'
		})
		if (!resolution) {
			// A child of a card-issuing parent shows the tab, but the cards live on the parent's page.
			const redirectSlug = resolveProtocolParamFromMetadata(protocol, metadataCache)?.metadata.cryptoCardRedirectSlug
			return redirectSlug ? canonicalRouteRedirect(`/protocol/card-details/${redirectSlug}`) : { notFound: true }
		}
		if (resolution.type === 'redirect') return canonicalRouteRedirect(resolution.destination)

		const { route } = resolution
		const props = await getCryptoCardDetailsPageProps({
			issuer: route.metadata.cryptoCardIssuer!,
			canonicalSlug: route.canonicalSlug,
			metadata: route.metadata,
			isCEX: false
		})
		if (!props) return { notFound: true, revalidate: maxAgeForNext([22]) }
		return { props, revalidate: maxAgeForNext([22]) }
	}
)

export const getStaticPaths = () => ({ paths: [], fallback: 'blocking' as const })

export default CryptoCardDetailsPage
