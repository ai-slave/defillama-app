import { Icon } from '~/components/Icon'
import { ExchangesNav } from '~/containers/Exchanges/ExchangesNav'
import { MicaTable } from '~/containers/Exchanges/MicaTable'
import type { MicaVenueModel } from '~/containers/Exchanges/models'
import { selectActivePromotion } from '~/containers/Exchanges/promotions'
import { loadMasterMicaVenues } from '~/containers/Exchanges/server/master.loaders'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

interface MicaPageProps {
	exchanges: MicaVenueModel[]
	asOfDate: string
}

export const getStaticProps = withPerformanceLogging<MicaPageProps>('mica', async () => {
	const exchanges = await loadMasterMicaVenues()
	return {
		props: { exchanges, asOfDate: new Date().toISOString().slice(0, 10) },
		revalidate: maxAgeForNext([22])
	}
})

export const MICA_PAGE_METADATA = {
	title: 'MiCA-regulated exchanges - DefiLlama',
	description:
		'Compare MiCA-licensed crypto exchanges available in the EU by liquidity, trading fees, perps availability, and KYC requirements.',
	canonicalUrl: '/mica',
	pageName: ['Exchanges']
}

export default function MicaPage({ exchanges, asOfDate }: MicaPageProps) {
	const promotionCount = exchanges.filter((exchange) => selectActivePromotion(exchange.promotions, asOfDate)).length
	return (
		<Layout {...MICA_PAGE_METADATA}>
			<ExchangesNav activePage="mica" />
			{promotionCount > 0 ? (
				<Card as="aside" padding="sm" className="flex items-center gap-2 body-sm text-secondary">
					<Icon name="gift" className="size-4 shrink-0 text-link" />
					<p>
						Negotiated offers are active on {promotionCount} {promotionCount === 1 ? 'exchange' : 'exchanges'}. Use the
						gift buttons to review each campaign and its terms.
					</p>
				</Card>
			) : null}

			{exchanges.length ? (
				<MicaTable venues={exchanges} asOfDate={asOfDate} />
			) : (
				<Card padding="md" className="text-center body-sm text-secondary">
					<p>No MiCA-licensed exchanges are present in the current catalog.</p>
				</Card>
			)}
		</Layout>
	)
}
