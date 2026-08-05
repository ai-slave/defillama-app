import type { InferGetStaticPropsType } from 'next'
import { PerformanceIndex } from '~/containers/MarketMakers/PerformanceIndex'
import { getPerformanceIndexProps, mergePerformanceIndex } from '~/containers/MarketMakers/PerformanceIndex/data'
import { forgdFetch } from '~/containers/MarketMakers/server/client'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('market-makers/performance-index', async () => {
	const props = await getPerformanceIndexProps(forgdFetch).catch(() => mergePerformanceIndex(null, null))
	return { props, revalidate: maxAgeForNext([22]) }
})

export default function MarketMakersPerformanceIndex(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Forgd Market Maker Performance Index Leaderboard - DefiLlama"
			description="Data-driven market maker rankings."
			canonicalUrl="/market-makers"
			pageName={['Market Makers', 'Performance Index']}
		>
			<PerformanceIndex {...props} />
		</Layout>
	)
}
