import { useExchangeCountry } from '~/containers/Exchanges/ExchangeCountrySelect'
import { ExchangesNav } from '~/containers/Exchanges/ExchangesNav'
import { ExchangeTokenFinder } from '~/containers/Exchanges/ExchangeTokenFinder'
import type { ExchangeDirectoryModel } from '~/containers/Exchanges/models'
import { loadMasterExchangeDirectory } from '~/containers/Exchanges/server/master.loaders'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

interface ExchangeTokensPageProps {
	directory: ExchangeDirectoryModel
}

export const getStaticProps = withPerformanceLogging<ExchangeTokensPageProps>('exchanges/tokens', async () => {
	const directory = await loadMasterExchangeDirectory()
	return { props: { directory }, revalidate: maxAgeForNext([22]) }
})

export default function ExchangeTokensPage({ directory }: ExchangeTokensPageProps) {
	const countryState = useExchangeCountry()
	return (
		<Layout
			title="Find Exchanges by Token - DefiLlama"
			description="Find exchanges that list all or any selected tokens across spot and perpetual markets."
			canonicalUrl="/exchanges/tokens"
			pageName={['Exchanges']}
		>
			<ExchangesNav activePage="tokens" country={countryState.country} />
			<ExchangeTokenFinder directory={directory} countryState={countryState} />
		</Layout>
	)
}
