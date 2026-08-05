import type { InferGetStaticPropsType } from 'next'
import { DEPTH_COLUMNS } from '~/containers/MarketMakers/constants'
import { Leaderboard } from '~/containers/MarketMakers/Leaderboard'
import { forgdFetch } from '~/containers/MarketMakers/server/client'
import { DEFAULT_TIMEFRAME, timeframeToRange } from '~/containers/MarketMakers/timeframe'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('market-makers/depth', async () => {
	const range = timeframeToRange(DEFAULT_TIMEFRAME, new Date())
	const payload = await forgdFetch('/market-maker/leaderboard/depth', range).catch(() => null)
	return { props: { payload }, revalidate: maxAgeForNext([22]) }
})

export default function DepthLeaderboard({ payload }: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Market Maker Depth Leaderboard - DefiLlama"
			description="Market makers ranked by average bid/ask depth and market share."
			canonicalUrl="/market-makers/depth"
			pageName={['Market Makers', 'Depth']}
		>
			<Leaderboard
				active="Depth"
				title="Depth Leaderboard"
				subtitle="See how Market Makers rank based on Depth KPIs such as the avg. value of bid & ask as well as percentage of market share."
				columns={DEPTH_COLUMNS}
				initialData={payload}
				fetchPath="depth"
				hasThreshold
			/>
		</Layout>
	)
}
