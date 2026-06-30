import type { ExchangeMetadataListEntry } from '~/containers/Markets/api.types'
import { MicaFinder } from '~/containers/Markets/MicaFinder'
import { fetchExchangeMetadataListFromNetwork } from '~/containers/Markets/server/upstream'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

type MicaPageProps = {
	exchanges: ExchangeMetadataListEntry[]
}

const SPOT_PRODUCT = 'spot'
const PERP_PRODUCT = 'perp'

export const getStaticProps = withPerformanceLogging<MicaPageProps>('mica', async () => {
	let exchanges: ExchangeMetadataListEntry[] = []
	try {
		const res = await fetchExchangeMetadataListFromNetwork()
		for (const exchange of res?.exchanges ?? []) {
			if (exchange.exchange === 'backpack') continue

			const hasSpot = exchange.products.includes(SPOT_PRODUCT)
			const hasPerps = exchange.products.includes(PERP_PRODUCT)
			const depth = exchange.depth_summary
			let row =
				hasSpot && hasPerps
					? exchange
					: {
							...exchange,
							depth_summary: {
								...depth,
								spot_ask_depth_2pct_usd: hasSpot ? depth.spot_ask_depth_2pct_usd : 0,
								spot_bid_depth_2pct_usd: hasSpot ? depth.spot_bid_depth_2pct_usd : 0,
								perp_ask_depth_2pct_usd: hasPerps ? depth.perp_ask_depth_2pct_usd : 0,
								perp_bid_depth_2pct_usd: hasPerps ? depth.perp_bid_depth_2pct_usd : 0
							},
							spot_fee: hasSpot ? exchange.spot_fee : { maker: null, taker: null },
							perp_fee: hasPerps ? exchange.perp_fee : { maker: null, taker: null }
						}

			if (row.exchange === 'kraken') row = { ...row, promotions: [] }
			if (row.exchange === 'cryptocom') row = { ...row, display_name: 'Crypto.com' }
			exchanges.push(row)
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
