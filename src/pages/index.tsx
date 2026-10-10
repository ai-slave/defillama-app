import type { InferGetStaticPropsType } from 'next/types'
import { ChainOverview } from '~/containers/ChainOverview'
import { ChainOverviewAnnouncement } from '~/containers/ChainOverview/Announcement'
import { getChainOverviewData } from '~/containers/ChainOverview/queries.server'
import type { IChainOverviewData } from '~/containers/ChainOverview/types'
import { fetchDailyBrief } from '~/containers/LlamaAI/dailyBrief/api'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { createRoutePhaseTimer, withPerformanceLogging } from '~/utils/perf'

const pageName = ['Overview']

export const getStaticProps = withPerformanceLogging<Omit<IChainOverviewData, 'extraTvlCharts'>>(
	'index',
	async () => {
		const phaseTimer = createRoutePhaseTimer()
		const stopGetStaticProps = phaseTimer.start('get_static_props_total')

		try {
			const metadataModule = await phaseTimer.time('metadata_import', () => import('~/utils/metadata'))
			await phaseTimer.time('metadata_refresh_dispatch', () =>
				metadataModule.refreshMetadataInBackgroundIfStale('homepage')
			)
			const metadataCache = metadataModule.default
			const [data, dailyBrief] = await Promise.all([
				phaseTimer.time('chain_overview_total', () =>
					getChainOverviewData({
						chain: 'All',
						chainMetadata: metadataCache.chainMetadata,
						protocolMetadata: metadataCache.protocolMetadata,
						categoriesAndTagsMetadata: metadataCache.categoriesAndTags,
						phaseTimer,
						includeHomepageRwaActiveMcap: true
					})
				),
				fetchDailyBrief()
			])
			if (!data) throw new Error('Missing homepage chain overview data')

			// The TVL settings series load from the chain charts API once a reader turns a setting on.
			const { extraTvlCharts: _extraTvlCharts, ...overview } = data
			return {
				props: { ...overview, dailyBrief },
				revalidate: maxAgeForNext([22])
			}
		} finally {
			stopGetStaticProps()
			phaseTimer.record()
		}
	},
	{ jitterRevalidate: false }
)

export default function HomePage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="DefiLlama - DeFi Dashboard & Crypto Analytics"
			description="Track Total Value Locked (TVL), revenue, fees, volume, and yields across 7000+ DeFi protocols on 500+ chains. Real-time DeFi analytics including protocol earnings, profit metrics, DEX volume, and transparent crypto data without ads."
			canonicalUrl=""
			tvlOptions={props.tvlOptions}
			pageName={pageName}
			announcement={<ChainOverviewAnnouncement />}
		>
			<ChainOverview {...props} />
		</Layout>
	)
}
