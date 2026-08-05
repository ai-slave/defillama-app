import type { InferGetStaticPropsType } from 'next'
import { SPREAD_COLUMNS } from '~/containers/MarketMakers/constants'
import { Leaderboard } from '~/containers/MarketMakers/Leaderboard'
import { forgdFetch } from '~/containers/MarketMakers/server/client'
import { DEFAULT_TIMEFRAME, timeframeToRange } from '~/containers/MarketMakers/timeframe'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('market-makers/spread', async () => {
	const range = timeframeToRange(DEFAULT_TIMEFRAME, new Date())
	const payload = await forgdFetch<unknown[]>('/market-maker/leaderboard/spread', range).catch(() => null)
	return { props: { rows: payload }, revalidate: maxAgeForNext([22]) }
})

export default function SpreadLeaderboard({ rows }: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Market Maker Spread Leaderboard - DefiLlama"
			description="Market makers ranked by bid-ask spread and uptime."
			canonicalUrl="/market-makers/spread"
			pageName={['Market Makers', 'Spread']}
		>
			<Leaderboard
				active="Spread"
				title="Spread Leaderboard"
				subtitle="See how Market Makers rank based on Spread KPIs such as the avg. top-of-book spread as well as their adherence to contractual obligations."
				columns={SPREAD_COLUMNS}
				initialData={rows}
				fetchPath="spread"
			/>
		</Layout>
	)
}
