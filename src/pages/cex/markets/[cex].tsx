import type { GetStaticPaths, GetStaticPropsContext } from 'next'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

export const getStaticProps = withPerformanceLogging(
	'cex/markets/[cex]:redirect',
	async ({ params }: GetStaticPropsContext<{ cex: string }>) => {
		if (!params?.cex) {
			return { notFound: true }
		}
		const revalidate = maxAgeForNext([22])

		const [{ default: metadataCache }, { resolveCexParamFromMetadata }] = await Promise.all([
			import('~/utils/metadata'),
			import('~/containers/Cexs/server/routes')
		])
		const cexRoute = resolveCexParamFromMetadata(params.cex, metadataCache)
		if (!cexRoute) return { notFound: true, revalidate }

		const { resolveExchangeByDefillamaCexSlug } = await import('~/containers/Markets/server/dataset.server')
		const exchange = await resolveExchangeByDefillamaCexSlug(cexRoute.canonicalSlug)
		return exchange
			? { ...canonicalRouteRedirect(`/exchange/${exchange.exchange}`), revalidate }
			: { notFound: true, revalidate }
	}
)

export const getStaticPaths: GetStaticPaths = () => ({ paths: [], fallback: 'blocking' })

export default function CexMarketsRedirect() {
	return null
}
