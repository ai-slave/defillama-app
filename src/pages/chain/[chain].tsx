import type { InferGetStaticPropsType } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { ChainOverview } from '~/containers/ChainOverview'
import { ChainOverviewAnnouncement } from '~/containers/ChainOverview/Announcement'
import { getChainOverviewData } from '~/containers/ChainOverview/queries.server'
import { ChainWarningBanners } from '~/containers/ChainOverview/WarningBanners'
import { getMainSiteIrDashboard } from '~/containers/Investors/mainSiteDashboards'
import { fetchCustomServerData } from '~/containers/Investors/serverDataRegistry'
import { fetchOptionalEntityQuestions } from '~/containers/LlamaAI/entityQuestions'
import Layout from '~/layout'
import { slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { createRoutePhaseTimer, withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

const pageName = ['Overview']

export const getStaticProps = withPerformanceLogging('chain/[chain]', async ({ params }) => {
	const phaseTimer = createRoutePhaseTimer()
	const stopGetStaticProps = phaseTimer.start('get_static_props_total')
	try {
		const chain = params.chain

		if (typeof chain !== 'string') {
			return { notFound: true }
		}

		const metadataCachePromise = phaseTimer.time('metadata_import', () =>
			import('~/utils/metadata').then((m) => m.default)
		)
		const chainRoutesPromise = phaseTimer.time(
			'chain_routes_import',
			() => import('~/containers/ChainOverview/server/routes')
		)
		const [metadataCache, { resolveChainParamFromMetadata }] = await Promise.all([
			metadataCachePromise,
			chainRoutesPromise
		])
		const isAllChain = chain.toLowerCase() === 'all'
		const chainRoute = isAllChain ? null : resolveChainParamFromMetadata(chain, metadataCache)
		if (chainRoute && chain !== chainRoute.canonicalSlug) {
			return canonicalRouteRedirect(`/chain/${chainRoute.canonicalSlug}`)
		}
		const normalizedChain = isAllChain ? 'All' : chainRoute?.canonicalName

		if (!normalizedChain) {
			return { notFound: true }
		}

		const data = await phaseTimer.time('chain_overview_data', () =>
			getChainOverviewData({
				chain: normalizedChain,
				chainMetadata: metadataCache.chainMetadata,
				protocolMetadata: metadataCache.protocolMetadata,
				categoriesAndTagsMetadata: metadataCache.categoriesAndTags,
				rwaChainsForActiveMcap: metadataCache.rwaList.chains,
				tokenDirectory: metadataCache.tokenDirectory,
				researchSponsorEntitySlug: chainRoute?.canonicalSlug,
				includeHomepageRwaActiveMcap: isAllChain
			})
		)

		if (!data) {
			throw new Error(`Missing page data for route=/chain/[chain] chain=${normalizedChain}`)
		}

		const normalizedSlug = slug(normalizedChain)
		const irDashboard = normalizedChain === 'All' ? undefined : getMainSiteIrDashboard('chain', normalizedSlug)
		const [{ questions: entityQuestions }, customServerData] = await Promise.all([
			normalizedChain !== 'All'
				? phaseTimer.time('entity_questions', () =>
						fetchOptionalEntityQuestions(normalizedChain, 'chain', normalizedSlug)
					)
				: Promise.resolve({ questions: [] }),
			irDashboard
				? phaseTimer.time('ir_custom_server_data', () => fetchCustomServerData(irDashboard.dashboardId))
				: Promise.resolve({})
		])

		return {
			props: { ...data, entityQuestions, customServerData },
			revalidate: maxAgeForNext([22])
		}
	} finally {
		stopGetStaticProps()
		phaseTimer.record()
	}
})

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

	const { getChainStaticPaths } = await import('~/containers/ChainOverview/server/routes')
	const paths = await getChainStaticPaths()

	return { paths, fallback: 'blocking' }
}

export default function Chain(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title={
				props.metadata.name === 'All'
					? 'DefiLlama - DeFi Dashboard & Crypto Analytics'
					: `${props.metadata.name} - DeFi TVL, Fees, & Revenue - DefiLlama`
			}
			description={props.description}
			canonicalUrl={props.metadata.name === 'All' ? '' : `/chain/${slug(props.metadata.name)}`}
			tvlOptions={props.tvlOptions}
			pageName={pageName}
			announcement={
				<>
					<ChainOverviewAnnouncement chainName={props.metadata.name} />
					<ChainWarningBanners warningBanners={props.warningBanners} chainName={props.metadata.name} />
				</>
			}
		>
			<ChainOverview {...props} />
		</Layout>
	)
}
