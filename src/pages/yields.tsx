import { Announcement } from '~/components/Announcement'
import { fetchEntityQuestions } from '~/containers/LlamaAI/api'
import { disclaimer } from '~/containers/Yields/constants'
import YieldPage from '~/containers/Yields/views/EarnView'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('yields', async () => {
	const [{ getEarnPageMeta }, { acquireYieldsSnapshot }] = await Promise.all([
		import('~/containers/Yields/data/earnMeta.server'),
		import('~/containers/Yields/server/dataset.server')
	])
	const [metadata, { questions: entityQuestions }] = await Promise.all([
		getEarnPageMeta(await acquireYieldsSnapshot('blocking')),
		fetchEntityQuestions('yields', 'page').catch(() => ({
			questions: [] as string[]
		}))
	])

	return {
		props: { ...metadata, entityQuestions },
		revalidate: maxAgeForNext([23])
	}
})

const pageName = ['Yields: Earn']

export default function ApyHomePage(data) {
	return (
		<Layout
			title="Yield Farming Rankings - Best DeFi APY Pools - DefiLlama"
			description="Find the best DeFi yield farming opportunities across all chains. Compare APY rates, TVL, and pool metrics for 10,000+ yield pools on Ethereum, Solana, Base, and 500+ networks. Real-time yield analytics."
			canonicalUrl={`/yields`}
			pageName={pageName}
		>
			<Announcement announcementId="yields-disclaimer" version="2026-03">
				{disclaimer}
			</Announcement>
			<YieldPage {...data} />
		</Layout>
	)
}
