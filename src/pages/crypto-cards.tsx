import { CardsTable } from '~/containers/CryptoCards/CardsTable'
import { CardsFilters } from '~/containers/CryptoCards/Filters'
import { getCryptoCardDetailsHrefs } from '~/containers/CryptoCards/issuers'
import type { CardsIndexModel } from '~/containers/CryptoCards/models'
import { mapCardsIndex } from '~/containers/CryptoCards/models'
import { PromoBanners } from '~/containers/CryptoCards/PromoBanners'
import { fetchCardsIndexFromNetwork } from '~/containers/CryptoCards/server/upstream'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging<CardsIndexModel>('crypto-cards', async () => {
	const { fetchAdapterChainMetrics } = await import('~/containers/AdapterMetrics/api')
	const [{ default: metadataCache }, index, issuerVolumes] = await Promise.all([
		import('~/utils/metadata'),
		fetchCardsIndexFromNetwork(),
		fetchAdapterChainMetrics({
			adapterType: 'dexs',
			chain: 'All',
			category: 'Crypto Card Issuer'
		}).catch(() => null)
	])
	const { rows, reference } = mapCardsIndex(
		index,
		getCryptoCardDetailsHrefs(metadataCache.protocolMetadata, index.cards),
		issuerVolumes?.protocols
	)
	return {
		props: { rows, reference },
		revalidate: maxAgeForNext([22])
	}
})

export const CRYPTO_CARDS_PAGE_METADATA = {
	title: 'Crypto Cards - DefiLlama',
	description:
		'Compare crypto debit and credit cards by cashback rewards, fees, supported chains and coins, requirements, and availability.',
	canonicalUrl: '/crypto-cards',
	pageName: ['Crypto Cards']
}

export default function CryptoCardsPage({ rows, reference }: CardsIndexModel) {
	return (
		<Layout {...CRYPTO_CARDS_PAGE_METADATA}>
			<header className="flex flex-col gap-1 px-1 pb-2">
				<h1 className="heading-sm">Crypto Cards</h1>
				<p className="body-sm text-secondary">
					Compare crypto debit and credit cards by cashback rewards, fees, supported chains, and availability. Expand
					cards with multiple tiers to compare their tier-specific terms.
				</p>
			</header>
			<PromoBanners />
			{rows.length > 0 ? (
				<>
					<CardsFilters rows={rows} />
					<CardsTable rows={rows} reference={reference} />
				</>
			) : (
				<Card padding="md" className="text-center body-sm text-secondary">
					<p>No crypto cards are present in the current catalog.</p>
				</Card>
			)}
		</Layout>
	)
}
