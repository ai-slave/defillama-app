import type { InferGetStaticPropsType } from 'next'
import { EarningsCalendarPage } from '~/containers/Equities/EarningsCalendarPage'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('equities/earnings-calendar', async () => {
	const { getNewYorkCalendarDate, loadEquitiesCalendarPageData } =
		await import('~/containers/Equities/server/marketData.server')
	const { buildEarningsCalendarBootstrap } = await import('~/containers/Equities/earningsCalendarData')
	const state = await loadEquitiesCalendarPageData()
	const todayET = getNewYorkCalendarDate(Date.now())
	const bootstrap =
		state.status === 'ready'
			? {
					...buildEarningsCalendarBootstrap(state.data.rows, state.data.companies, todayET),
					todayET,
					updatedAt: state.data.updatedAt,
					stale: state.stale
				}
			: null

	return {
		props: { bootstrap },
		revalidate: maxAgeForNext([5])
	}
})

export default function EquityEarningsCalendarRoute({ bootstrap }: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Earnings Calendar - DefiLlama"
			description="Browse filing-backed and projected earnings dates for US-listed companies, ranked by market capitalization."
			canonicalUrl="/equities/earnings-calendar"
			pageName={['Earnings Calendar']}
		>
			<EarningsCalendarPage bootstrap={bootstrap ?? undefined} />
		</Layout>
	)
}
