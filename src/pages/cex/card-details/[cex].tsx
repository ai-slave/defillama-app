import type { GetStaticPropsContext } from 'next'
import { CryptoCardDetailsPage } from '~/containers/CryptoCards/CardDetails'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

export const getStaticProps = withPerformanceLogging(
	'cex/card-details/[cex]',
	async ({ params }: GetStaticPropsContext<{ cex: string }>) => {
		if (!params?.cex) return { notFound: true }

		const [{ default: metadataCache }, { resolveCexParamFromMetadata }, { getCryptoCardDetailsPageProps }] =
			await Promise.all([
				import('~/utils/metadata'),
				import('~/containers/Cexs/server/routes'),
				import('~/containers/CryptoCards/server/detailsPage')
			])
		const cexRoute = resolveCexParamFromMetadata(params.cex, metadataCache)
		const issuer = cexRoute?.metadata.cryptoCardIssuer
		if (!cexRoute || !issuer) return { notFound: true }
		if (params.cex !== cexRoute.canonicalSlug) {
			return canonicalRouteRedirect(`/cex/card-details/${cexRoute.canonicalSlug}`, true)
		}

		const props = await getCryptoCardDetailsPageProps({
			issuer,
			canonicalSlug: cexRoute.canonicalSlug,
			metadata: cexRoute.metadata,
			isCEX: true
		})
		if (!props) return { notFound: true, revalidate: maxAgeForNext([22]) }
		return { props, revalidate: maxAgeForNext([22]) }
	}
)

export const getStaticPaths = () => ({ paths: [], fallback: 'blocking' as const })

export default CryptoCardDetailsPage
