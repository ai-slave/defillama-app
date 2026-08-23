import type { GetStaticPropsContext } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { AdapterByChain } from '~/containers/AdapterMetrics/AdapterByChain'
import { ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { getAdapterByChainPageData } from '~/containers/AdapterMetrics/queries'
import { addDimensionChainRouteTelemetry } from '~/containers/AdapterMetrics/telemetry'
import type { IAdapterByChainPageData } from '~/containers/AdapterMetrics/types'
import Layout from '~/layout'
import { slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

const adapterType = ADAPTER_TYPES.FEES
const type = 'P/F'

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

export const getStaticProps = withPerformanceLogging(
	`fees/pf/chain/[chain]`,
	async ({ params }: GetStaticPropsContext<{ chain: string }>) => {
		const chain = slug(params.chain)
		const [{ default: metadataCache }, { getChainRouteRedirectDestination, resolveChainFeatureParamFromMetadata }] =
			await Promise.all([import('~/utils/metadata'), import('~/containers/ChainOverview/server/routes')])
		const chainRoute = resolveChainFeatureParamFromMetadata(params.chain, metadataCache, (metadata) =>
			Boolean(metadata.fees)
		)
		const metadata = chainRoute?.metadata

		addDimensionChainRouteTelemetry({
			adapterType,
			chain: metadata?.name ?? chain,
			canonicalRoute: '/pf/chain/[chain]',
			metadataFlag: 'fees'
		})

		if (!chainRoute) {
			return { notFound: true }
		}
		const redirectDestination = getChainRouteRedirectDestination(params.chain, chainRoute, 'pf/chain')
		if (redirectDestination) {
			return canonicalRouteRedirect(redirectDestination)
		}

		const data = await getAdapterByChainPageData({
			adapterType,
			chain: metadata.name,
			route: 'pf',
			metricName: type
		})

		if (!data) throw new Error(`Missing page data for route=/pf/chain/[chain] chain=${chain}`)

		return {
			props: data,
			revalidate: maxAgeForNext([22])
		}
	}
)

const pageName = ['Protocols', 'ranked by', type]

const FeesOnChain = (props: IAdapterByChainPageData) => {
	return (
		<Layout
			title={`Price to Fees (P/F) Ratio on ${props.chain} - DefiLlama`}
			description={`Compare Price to Fees (P/F) ratios for DeFi protocols on ${props.chain}. Evaluate valuations relative to fees generated.`}
			canonicalUrl={`/pf/chain/${slug(props.chain)}`}
			pageName={pageName}
		>
			<AdapterByChain {...props} type={type} defaultSorting={[{ id: 'pfOrPs', desc: true }]} />
		</Layout>
	)
}

export default FeesOnChain
