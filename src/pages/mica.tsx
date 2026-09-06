import { MicaTable } from '~/containers/Exchanges/MicaTable'
import type { MicaVenueRowModel } from '~/containers/Exchanges/models'
import { selectActivePromotion } from '~/containers/Exchanges/promotions'
import { loadMasterMicaVenues } from '~/containers/Exchanges/server/master.loaders'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

interface MicaPageProps {
	exchanges: Array<MicaVenueRowModel>
}

export const getStaticProps = withPerformanceLogging<MicaPageProps>('mica', async () => {
	const asOfDate = new Date().toISOString().slice(0, 10)
	const exchanges = (await loadMasterMicaVenues()).map((exchange) => ({
		...exchange,
		activePromotion: selectActivePromotion(exchange.promotions, asOfDate)
	}))
	return {
		props: { exchanges },
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

export default function MicaPage({ exchanges }: MicaPageProps) {
	const promotionCount = exchanges.filter((exchange) => exchange.activePromotion !== null).length
	return (
		<Layout {...MICA_PAGE_METADATA}>
			<header className="flex flex-col gap-1 px-1 pb-2">
				<h1 className="heading-sm">MiCA-regulated exchanges</h1>
				<p className="body-sm text-secondary">
					Compare EU-regulated exchanges by liquidity, fees, funding options, and verification requirements.
				</p>
			</header>
			{promotionCount > 0 ? (
				<Card as="aside" padding="sm" className="flex items-center gap-2 body-sm text-secondary">
					<Icon name="gift" className="size-4 shrink-0 text-link" />
					<p>
						Negotiated offers are active on {promotionCount} {promotionCount === 1 ? 'exchange' : 'exchanges'}. Use the
						gift buttons to review each campaign and its terms.
					</p>
				</Card>
			) : null}

			{exchanges.length > 0 ? (
				<MicaTable venues={exchanges} />
			) : (
				<Card padding="md" className="text-center body-sm text-secondary">
					<p>No MiCA-licensed exchanges are present in the current catalog.</p>
				</Card>
			)}
		</Layout>
	)
}
