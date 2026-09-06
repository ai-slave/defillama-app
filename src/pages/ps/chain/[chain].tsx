import type { GetStaticPropsContext } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { AdapterByChain } from '~/containers/AdapterMetrics/AdapterByChain'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { getAdapterByChainPageData } from '~/containers/AdapterMetrics/queries'
import { addDimensionChainRouteTelemetry } from '~/containers/AdapterMetrics/telemetry'
import type { IAdapterByChainPageData } from '~/containers/AdapterMetrics/types'
import Layout from '~/layout'
import { slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

const adapterType = ADAPTER_TYPES.FEES
const dataType = ADAPTER_DATA_TYPES.DAILY_REVENUE
const type = 'P/S'

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
	`revenue/ps/chain/[chain]`,
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
			canonicalRoute: '/ps/chain/[chain]',
			dataType,
			metadataFlag: 'fees'
		})

		if (!chainRoute) {
			return { notFound: true }
		}
		const redirectDestination = getChainRouteRedirectDestination(params.chain, chainRoute, 'ps/chain')
		if (redirectDestination) {
			return canonicalRouteRedirect(redirectDestination)
		}

		const data = await getAdapterByChainPageData({
			adapterType,
			dataType,
			chain: metadata.name,
			route: 'ps',
			metricName: type
		})

		if (!data) throw new Error(`Missing page data for route=/ps/chain/[chain] chain=${chain}`)

		return {
			props: data,
			revalidate: maxAgeForNext([22])
		}
	}
)

const pageName = ['Protocols', 'ranked by', type]

function RevenueOnChain(props: IAdapterByChainPageData) {
	return (
		<Layout
			title={`Price to Sales (P/S) Ratio on ${props.chain} - DefiLlama`}
			description={`Compare Price to Sales (P/S) ratios for DeFi protocols on ${props.chain}. Identify undervalued protocols by revenue multiples.`}
			canonicalUrl={`/ps/chain/${slug(props.chain)}`}
			pageName={pageName}
		>
			<AdapterByChain {...props} type={type} defaultSorting={[{ id: 'pfOrPs', desc: true }]} />
		</Layout>
	)
}

export default RevenueOnChain
