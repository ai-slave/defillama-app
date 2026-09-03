import type { GetStaticPropsContext } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { ProtocolOverview } from '~/containers/ProtocolOverview'
import { getProtocolOverviewPageData } from '~/containers/ProtocolOverview/queries'
import type { IProtocolOverviewPageData } from '~/containers/ProtocolOverview/types'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

export const getStaticProps = withPerformanceLogging(
	'cex/[cex]',
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
			console.warn(`[cex/[cex]] ${exchangeName} not found in protocol metadata cache`)
			return {
				notFound: true
			}
		}
		const protocolMetadata = cexRoute.metadata
		if (exchangeName !== cexRoute.canonicalSlug) {
			return canonicalRouteRedirect(`/cex/${cexRoute.canonicalSlug}`, true)
		}

		const yieldsSnapshot = protocolMetadata.yields
			? await import('~/containers/Yields/server/dataset.server').then(({ acquireOptionalYieldsSnapshot }) =>
					acquireOptionalYieldsSnapshot()
				)
			: null
		const data = await getProtocolOverviewPageData({
			protocolId: cexRoute.id,
			currentProtocolMetadata: protocolMetadata,
			isCEX: true,
			chainMetadata: metadataCache.chainMetadata,
			tokenlist: metadataCache.tokenlist,
			cgExchangeIdentifiers: metadataCache.cgExchangeIdentifiers,
			emissionsSupplyMetrics: metadataCache.emissionsSupplyMetrics,
			researchSponsorEntitySlug: cexRoute.canonicalSlug,
			yieldsSnapshot
		})

		if (!data) {
			console.warn(`[cex/[cex]] ${exchangeName} matched metadata but overview data was unavailable`)
			return { notFound: true }
		}

		return { props: data, revalidate: maxAgeForNext([22]) }
	}
)

export async function getStaticPaths() {
	// When this is true (in preview environments) don't
	// prerender any static pages
	// (faster builds, but slower initial page load)
	if (SKIP_BUILD_STATIC_GENERATION) {
		return {
			paths: [],
			fallback: 'blocking'
		}
	}

	const { getCexStaticPaths } = await import('~/containers/Cexs/server/routes')
	const paths = await getCexStaticPaths()

	return { paths, fallback: 'blocking' }
}

export default function Protocols(props: IProtocolOverviewPageData) {
	return <ProtocolOverview {...props} />
}
