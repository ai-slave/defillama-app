import type { InferGetStaticPropsType } from 'next'
import { useRouter } from 'next/router'
import { tvlOptions } from '~/components/Filters/options'
import { getChainOverviewData } from '~/containers/ChainOverview/queries.server'
import { getChainsByCategory } from '~/containers/ChainsByCategory/queries'
import { DefiWatchlistContainer } from '~/containers/DeFiWatchlist'
import { getTokensSourceData } from '~/containers/Tokens/queries.server'
import { TokensWatchlistContainer } from '~/containers/TokensWatchlist'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('watchlist', async () => {
	const metadataCache = await import('~/utils/metadata').then((m) => m.default)

	const [{ protocols }, { chains }, tokenUniverse] = await Promise.all([
		getChainOverviewData({
			chain: 'All',
			chainMetadata: metadataCache.chainMetadata,
			protocolMetadata: metadataCache.protocolMetadata,
			categoriesAndTagsMetadata: metadataCache.categoriesAndTags
		}),
		getChainsByCategory({
			chainMetadata: metadataCache.chainMetadata,
			category: 'All',
			sampledChart: true
		}),
		// Lightweight picker universe for the Tokens tab. Don't let a token-data failure break the DeFi watchlist.
		getTokensSourceData()
			.then(({ rows }) => rows.map((row) => ({ id: row.id, name: row.name, symbol: row.symbol })))
			.catch(() => [])
	])

	return {
		props: {
			chains,
			protocols,
			tokenUniverse
		},
		revalidate: maxAgeForNext([22])
	}
})

export default function Portfolio({
	protocols,
	chains,
	tokenUniverse
}: InferGetStaticPropsType<typeof getStaticProps>) {
	const router = useRouter()
	const isTokensTab = router.query.tab === 'tokens'

	return (
		<Layout
			title="Watchlist - Track DeFi Protocols, Chains & Tokens - DefiLlama"
			description="Create your personalized DeFi watchlist to track favorite protocols, chains, and tokens. Monitor TVL changes, APY rates, price movements, and the markets your tokens trade on in one dashboard."
			canonicalUrl={`/watchlist`}
			tvlOptions={isTokensTab ? undefined : tvlOptions}
		>
			{isTokensTab ? (
				<TokensWatchlistContainer tokenUniverse={tokenUniverse} />
			) : (
				<DefiWatchlistContainer protocols={protocols} chains={chains} />
			)}
		</Layout>
	)
}
