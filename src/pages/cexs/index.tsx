import { Cexs } from '~/containers/Cexs'
import { attachExchangeMarkets } from '~/containers/Cexs/exchangeMarkets'
import { getCexsPageData } from '~/containers/Cexs/queries'
import type { ICex } from '~/containers/Cexs/types'
import { ExchangesNav } from '~/containers/Exchanges/ExchangesNav'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('cexs/index', async () => {
	const { fetchCexExchangeSlugIndex } = await import('~/containers/Markets/server/dataset.server')
	const [data, cexIndex] = await Promise.all([getCexsPageData(), fetchCexExchangeSlugIndex()])
	return {
		props: { cexs: attachExchangeMarkets(data.cexs, cexIndex) },
		revalidate: maxAgeForNext([22])
	}
})

export const CEXS_PAGE_METADATA = {
	title: 'Crypto Exchange Reserves and Inflows - DefiLlama',
	description:
		'Compare assets held in tracked centralized exchange wallets, clean reserves, and net inflows. Reserve assets do not include exchange liabilities.',
	canonicalUrl: '/cexs',
	pageName: ['Exchanges']
}

export default function CexsPage({ cexs }: { cexs: Array<ICex> }) {
	return (
		<Layout {...CEXS_PAGE_METADATA}>
			<ExchangesNav activePage="reserves" />
			<Cexs cexs={cexs} />
		</Layout>
	)
}
