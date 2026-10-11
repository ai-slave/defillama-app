import type { InferGetStaticPropsType } from 'next'
import { VOLUME_COLUMNS } from '~/containers/MarketMakers/constants'
import { Leaderboard } from '~/containers/MarketMakers/Leaderboard'
import { forgdFetch } from '~/containers/MarketMakers/server/client'
import { DEFAULT_TIMEFRAME, timeframeToRange } from '~/containers/MarketMakers/timeframe'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('market-makers/volume', async () => {
	const range = timeframeToRange(DEFAULT_TIMEFRAME, new Date())
	const payload = await forgdFetch<Array<unknown>>('/market-maker/leaderboard/volume', range).catch(() => null)
	return { props: { rows: payload }, revalidate: maxAgeForNext([22]) }
})

export default function VolumeLeaderboard({ rows }: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Market Maker Volume Leaderboard - DefiLlama"
			description="Market makers ranked by fill volume."
			canonicalUrl="/market-makers/volume"
			pageName={['Market Makers', 'Volume']}
		>
			<Leaderboard
				active="Volume"
				title="Volume leaderboard"
				subtitle="See how Market Makers rank based on Volume KPIs such as the avg. daily fill volume (maker & taker) as well as percentage of market share"
				columns={VOLUME_COLUMNS}
				initialData={rows}
				fetchPath="volume"
			/>
		</Layout>
	)
}
