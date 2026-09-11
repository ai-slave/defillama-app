import { ExchangeAccessGate } from '~/containers/Exchanges/ExchangeAccessGate'
import { ExchangeRanking } from '~/containers/Exchanges/ExchangeRanking'
import { ExchangesNav } from '~/containers/Exchanges/ExchangesNav'
import type { ExchangeRankingModel } from '~/containers/Exchanges/models'
import { loadMasterExchangeRanking } from '~/containers/Exchanges/server/master.loaders'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

interface ExchangeRankPageProps {
	ranking: ExchangeRankingModel | null
}

export const getStaticProps = withPerformanceLogging<ExchangeRankPageProps>('exchanges/rank', async () => ({
	props: { ranking: await loadMasterExchangeRanking() },
	revalidate: maxAgeForNext([22])
}))

export const EXCHANGE_RANK_PAGE_METADATA = {
	title: 'REAL Ranking — Exchange Scores - DefiLlama',
	description:
		'The REAL score: every exchange rated on Reserves, measured Execution, verified Activity and observed Liquidity, with the methodology behind each pillar.',
	canonicalUrl: '/exchanges/rank',
	pageName: ['Exchanges']
}

export default function ExchangeRankPage({ ranking }: ExchangeRankPageProps) {
	return (
		<ExchangeAccessGate>
			<Layout {...EXCHANGE_RANK_PAGE_METADATA}>
				<ExchangesNav activePage="rank" />
				<ExchangeRanking ranking={ranking} />
			</Layout>
		</ExchangeAccessGate>
	)
}
