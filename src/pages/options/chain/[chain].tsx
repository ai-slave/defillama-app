import type { GetStaticPropsContext } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { AdapterByChain } from '~/containers/AdapterMetrics/AdapterByChain'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { getAdapterByChainPageData, getDimensionAdapterOverviewOfAllChains } from '~/containers/AdapterMetrics/queries'
import { addDimensionChainRouteTelemetry } from '~/containers/AdapterMetrics/telemetry'
import type { IAdapterByChainPageData } from '~/containers/AdapterMetrics/types'
import Layout from '~/layout'
import { slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

const adapterType = ADAPTER_TYPES.OPTIONS
const dataType = ADAPTER_DATA_TYPES.DAILY_PREMIUM_VOLUME
const type = 'Options'

export const getStaticPaths = async () => {
	// When this is true (in preview environments) don't
	// prerender any static pages
	// (faster builds, but slower initial page load)
	if (SKIP_BUILD_STATIC_GENERATION) {
		return {
			paths: [],
			fallback: 'blocking'
		}
	}

	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	let chains: Record<string, { '24h'?: number; '7d'?: number; '30d'?: number }> = {}
	try {
		chains = getDimensionAdapterOverviewOfAllChains({
			adapterType,
			dataType,
			chainMetadata: metadataCache.chainMetadata
		})
	} catch {
		// Prerender no chain paths when the API is unavailable; they render on demand.
	}
	const paths = Object.entries(chains)
		.sort(([, a], [, b]) => (b?.['24h'] ?? 0) - (a?.['24h'] ?? 0))
		.slice(0, 10)
		.map(([chain]) => ({ params: { chain: slug(chain) } }))

	return { paths, fallback: 'blocking' }
}

export const getStaticProps = withPerformanceLogging(
	`${type}/chain/[chain]`,
	async ({ params }: GetStaticPropsContext<{ chain: string }>) => {
		const chain = slug(params.chain)
		const [{ default: metadataCache }, { getChainRouteRedirectDestination, resolveChainFeatureParamFromMetadata }] =
			await Promise.all([import('~/utils/metadata'), import('~/containers/ChainOverview/server/routes')])
		const chainRoute = resolveChainFeatureParamFromMetadata(params.chain, metadataCache, (metadata) =>
			Boolean(metadata.optionsPremiumVolume)
		)
		const metadata = chainRoute?.metadata

		addDimensionChainRouteTelemetry({
			adapterType,
			chain: metadata?.name ?? chain,
			canonicalRoute: '/options/chain/[chain]',
			dataType,
			metadataFlag: 'optionsPremiumVolume'
		})

		if (!chainRoute) {
			return { notFound: true }
		}
		const redirectDestination = getChainRouteRedirectDestination(params.chain, chainRoute, 'options/chain')
		if (redirectDestination) {
			return canonicalRouteRedirect(redirectDestination)
		}

		const data = await getAdapterByChainPageData({
			adapterType,
			dataType,
			chain: metadata.name,
			route: 'options',
			hasOpenInterest: true,
			hasOptionsMetrics: true,
			metricName: 'Options Premium Volume'
		})

		if (!data) throw new Error(`Missing page data for route=/options/chain/[chain] chain=${chain}`)

		return {
			props: data,
			revalidate: maxAgeForNext([22])
		}
	}
)

const pageName = ['Protocols', 'ranked by', 'Options Premium Volume']
const defaultSorting = [{ id: 'total7d', desc: true }]

function OptionsOnChain(props: IAdapterByChainPageData) {
	return (
		<Layout
			title={`${props.chain} Options Exchange Rankings - Premium Volume, Notional Volume & Open Interest - DefiLlama`}
			description={`Track options exchanges on ${props.chain} by premium volume, notional volume and open interest.`}
			canonicalUrl={`/options/chain/${slug(props.chain)}`}
			pageName={pageName}
		>
			<AdapterByChain {...props} type={type} defaultSorting={defaultSorting} />
		</Layout>
	)
}

export default OptionsOnChain
