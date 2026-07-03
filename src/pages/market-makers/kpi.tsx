import type { InferGetStaticPropsType } from 'next'
import { MarketMakersAccessGate } from '~/containers/MarketMakers/AccessGate'
import { KPI_COLUMNS } from '~/containers/MarketMakers/constants'
import { Leaderboard } from '~/containers/MarketMakers/Leaderboard'
import { forgdFetch } from '~/containers/MarketMakers/server/client'
import { DEFAULT_TIMEFRAME, timeframeToRange } from '~/containers/MarketMakers/timeframe'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('market-makers/kpi', async () => {
	const range = timeframeToRange(DEFAULT_TIMEFRAME, new Date())
	const payload = await forgdFetch<unknown[]>('/market-maker/leaderboard/kpi', range).catch(() => null)
	return { props: { rows: payload }, revalidate: maxAgeForNext([22]) }
})

export default function KpiLeaderboard({ rows }: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Market Maker KPI Adherence Leaderboard - DefiLlama"
			description="Market makers ranked by KPI adherence across depth, spread, and uptime."
			canonicalUrl="/market-makers/kpi"
			pageName={['Market Makers', 'KPI Adherence']}
		>
			<MarketMakersAccessGate>
				<Leaderboard
					active="KPI Adherence"
					title="KPI Adherence Leaderboard"
					subtitle="See how Market Makers rank based on adherence to contractual obligations."
					columns={KPI_COLUMNS}
					initialData={rows}
					fetchPath="kpi"
				/>
			</MarketMakersAccessGate>
		</Layout>
	)
}
