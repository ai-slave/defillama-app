import { ExchangeResearch } from '~/containers/Exchanges/ExchangeResearch'
import { ExchangesNav } from '~/containers/Exchanges/ExchangesNav'
import { fetchExchangeResearchReport } from '~/containers/Exchanges/master.api'
import { loadMasterResearchReports } from '~/containers/Exchanges/server/master.loaders'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('exchanges/charts', async () => {
	await loadMasterResearchReports()
	return { props: {}, revalidate: maxAgeForNext([22]) }
})

export const EXCHANGE_RESEARCH_PAGE_METADATA = {
	title: 'Exchange Research Charts - DefiLlama',
	description:
		'Compare historical exchange volume, open interest, order-book depth, and liquidity-normalized volume across selectable ranges.',
	canonicalUrl: '/exchanges/charts',
	pageName: ['Exchanges']
}

export default function ExchangeChartsPage() {
	return (
		<Layout {...EXCHANGE_RESEARCH_PAGE_METADATA}>
			<ExchangesNav activePage="charts" />
			<ExchangeResearch loadReport={fetchExchangeResearchReport} />
		</Layout>
	)
}
