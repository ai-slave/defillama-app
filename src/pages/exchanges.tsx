import { useExchangeCountry } from '~/containers/Exchanges/ExchangeCountrySelect'
import { ExchangeDirectory } from '~/containers/Exchanges/ExchangeDirectory'
import { ExchangesNav } from '~/containers/Exchanges/ExchangesNav'
import { fetchExchangeDirectoryOverview } from '~/containers/Exchanges/master.api'
import type { ExchangeDirectoryModel } from '~/containers/Exchanges/models'
import { loadMasterExchangeDirectory } from '~/containers/Exchanges/server/master.loaders'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

interface ExchangesPageProps {
	directory: ExchangeDirectoryModel
}

export const getStaticProps = withPerformanceLogging<ExchangesPageProps>('exchanges', async () => ({
	props: { directory: await loadMasterExchangeDirectory() },
	revalidate: maxAgeForNext([22])
}))

export const EXCHANGES_PAGE_METADATA = {
	title: 'Crypto Exchange Volume, Liquidity and Transparency - DefiLlama',
	description:
		'Compare centralized and decentralized exchanges across spot and perpetual volume, open interest, liquidity, fees, reserves, and compliance metadata.',
	canonicalUrl: '/exchanges',
	pageName: ['Exchanges']
}

export default function ExchangesPage({ directory }: ExchangesPageProps) {
	const countryState = useExchangeCountry()
	return (
		<Layout {...EXCHANGES_PAGE_METADATA}>
			<ExchangesNav activePage="exchanges" country={countryState.country} />
			<ExchangeDirectory
				directory={directory}
				loadOverview={fetchExchangeDirectoryOverview}
				countryState={countryState}
			/>
		</Layout>
	)
}
