import type { InferGetStaticPropsType } from 'next'
import { Announcement } from '~/components/Announcement'
import { fetchEntityQuestions } from '~/containers/LlamaAI/api'
import { disclaimer } from '~/containers/Yields/constants'
import YieldPage, { type EarnViewProps } from '~/containers/Yields/views/EarnView'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging<EarnViewProps>('yields', async () => {
	const [{ getEarnPageMeta }, { getEarnPage }, { acquireYieldsSnapshot }] = await Promise.all([
		import('~/containers/Yields/data/earnMeta.server'),
		import('~/containers/Yields/data/earn.server'),
		import('~/containers/Yields/server/dataset.server')
	])
	const snapshot = await acquireYieldsSnapshot('blocking')
	const [metadata, initialEarnPage, { questions: entityQuestions }] = await Promise.all([
		getEarnPageMeta(snapshot),
		// Default-view first page: rows in the initial HTML, and the same call
		// warms the prepared-rows cache for the API's first readers.
		getEarnPage(snapshot, {}),
		fetchEntityQuestions('yields', 'page')
	])

	return {
		props: { ...metadata, entityQuestions, initialEarnPage, initialEarnPageGeneratedAt: snapshot.generatedAt },
		revalidate: maxAgeForNext([23])
	}
})

const pageName = ['Yields: Earn']

export default function ApyHomePage(data: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Yield Farming Rankings - Best DeFi APY Pools - DefiLlama"
			description="Find the best DeFi yield farming opportunities across all chains. Compare APY rates, TVL, and pool metrics for 10,000+ yield pools on Ethereum, Solana, Base, and 500+ networks. Real-time yield analytics."
			canonicalUrl="/yields"
			pageName={pageName}
		>
			<Announcement announcementId="yields-disclaimer" version="2026-03">
				{disclaimer}
			</Announcement>
			<YieldPage {...data} />
		</Layout>
	)
}
