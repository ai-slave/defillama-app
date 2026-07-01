import type { ExchangeMetadataListEntry } from '~/containers/Markets/api.types'
import { MicaFinder, type MicaExchange } from '~/containers/Markets/MicaFinder'
import { fetchExchangeMetadataListFromNetwork } from '~/containers/Markets/server/upstream'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

type MicaPageProps = {
	exchanges: MicaExchange[]
}

const SPOT_PRODUCT = 'spot'
const PERP_PRODUCT = 'perp'
const EXCLUDED_EXCHANGES = new Set(['backpack', 'bybit'])

function shouldShowMicaExchange(exchange: ExchangeMetadataListEntry) {
	if (EXCLUDED_EXCHANGES.has(exchange.exchange)) return false
	if (!exchange.mica_licensed) return false
	if (exchange.eu_status && exchange.eu_status !== 'available') return false
	return true
}

function getMicaProducts(exchange: ExchangeMetadataListEntry) {
	return exchange.products.includes(PERP_PRODUCT) ? [PERP_PRODUCT] : []
}

function getMicaPromotions(exchange: ExchangeMetadataListEntry): MicaExchange['promotions'] {
	if (exchange.exchange === 'kraken') return []
	return (exchange.promotions ?? []).map((promotion) => ({
		ends_at: promotion.ends_at ?? null,
		label: promotion.label,
		priority: promotion.priority ?? null,
		source: promotion.source ? { url: promotion.source.url } : null,
		starts_at: promotion.starts_at ?? null,
		subtitle: promotion.subtitle ?? null,
		terms_url: promotion.terms_url ?? null,
		title: promotion.title,
		url: promotion.url ?? null
	}))
}

function getMicaExchange(exchange: ExchangeMetadataListEntry): MicaExchange {
	const hasSpot = exchange.products.includes(SPOT_PRODUCT)
	const hasPerps = exchange.products.includes(PERP_PRODUCT)
	const depth = exchange.depth_summary

	return {
		depth_summary: {
			isPartialCoverage: depth.isPartialCoverage,
			spot_ask_depth_2pct_usd: hasSpot ? depth.spot_ask_depth_2pct_usd : 0,
			spot_bid_depth_2pct_usd: hasSpot ? depth.spot_bid_depth_2pct_usd : 0,
			perp_ask_depth_2pct_usd: hasPerps ? depth.perp_ask_depth_2pct_usd : 0,
			perp_bid_depth_2pct_usd: hasPerps ? depth.perp_bid_depth_2pct_usd : 0
		},
		display_name: exchange.exchange === 'cryptocom' ? 'Crypto.com' : exchange.display_name,
		eu_status: exchange.eu_status,
		exchange: exchange.exchange,
		kyc_required: exchange.kyc_required,
		kyc_short: exchange.kyc_short,
		kyc_summary: exchange.kyc_summary ?? null,
		mica_licensed: exchange.mica_licensed,
		perp_fee: hasPerps ? exchange.perp_fee : { maker: null, taker: null },
		products: getMicaProducts(exchange),
		promotions: getMicaPromotions(exchange),
		ref_link: exchange.ref_link,
		secondary: exchange.secondary,
		spot_fee: hasSpot ? exchange.spot_fee : { maker: null, taker: null },
		website: exchange.website
	}
}

export const getStaticProps = withPerformanceLogging<MicaPageProps>('mica', async () => {
	let exchanges: MicaExchange[] = []
	try {
		const res = await fetchExchangeMetadataListFromNetwork()
		for (const exchange of res?.exchanges ?? []) {
			if (!shouldShowMicaExchange(exchange)) continue
			exchanges.push(getMicaExchange(exchange))
		}
	} catch (e) {
		// The metadata origin may be unavailable at build time — never fail the
		// build over the directory; render the empty state instead.
		console.warn('[mica] metadata-list fetch failed, rendering empty state:', (e as Error).message)
	}

	return {
		props: { exchanges },
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['MiCA-regulated exchanges']

export default function MicaPage({ exchanges }: MicaPageProps) {
	return (
		<Layout
			title="MiCA-regulated exchanges - DefiLlama"
			description="Compare MiCA-licensed crypto exchanges available in the EU by liquidity, trading fees, perps availability, and KYC requirements."
			canonicalUrl="/mica"
			pageName={pageName}
		>
			{exchanges.length ? (
				<MicaFinder exchanges={exchanges} />
			) : (
				<p className="rounded-md border border-(--cards-border) bg-(--cards-bg) p-12 text-center text-sm text-(--text-label)">
					Exchange directory is being updated. Please check back shortly.
				</p>
			)}
		</Layout>
	)
}
