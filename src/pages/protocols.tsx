import type { InferGetStaticPropsType } from 'next'
import { tvlOptions } from '~/components/Filters/options'
import { isProtocolListTvlKey } from '~/containers/ProtocolLists/api.types'
import { getProtocolRankingRows, paginateProtocolRankingRows } from '~/containers/ProtocolRankings/pagination.server'
import { getProtocolRankingsSnapshot } from '~/containers/ProtocolRankings/server/tableData.server'
import { ChainProtocolsTable } from '~/containers/ProtocolRankings/Table'
import { DEFAULT_PROTOCOL_RANKING_QUERY, PROTOCOL_RANKINGS_LIMITS } from '~/containers/ProtocolRankings/tableQuery'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

const protocolTvlOptions = tvlOptions.filter((option) => isProtocolListTvlKey(option.key))

export const getStaticProps = withPerformanceLogging('protocols', async () => {
	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	// One shared aggregation: the same Redis-cached, publication-gated snapshot
	// the homepage and watchlist read, instead of a bespoke adapter fan-out.
	const snapshot = await getProtocolRankingsSnapshot({
		chain: 'All',
		chainMetadata: metadataCache.chainMetadata,
		protocolMetadata: metadataCache.protocolMetadata,
		categoriesAndTagsMetadata: metadataCache.categoriesAndTags
	})

	const { rows: protocols, ...protocolRankings } = paginateProtocolRankingRows({
		snapshot,
		query: DEFAULT_PROTOCOL_RANKING_QUERY,
		prepared: getProtocolRankingRows(snapshot, DEFAULT_PROTOCOL_RANKING_QUERY),
		limit: PROTOCOL_RANKINGS_LIMITS.initial
	})

	return {
		props: {
			protocols,
			protocolRankings
		},
		revalidate: maxAgeForNext([22])
	}
})

export default function Protocols({ protocols, protocolRankings }: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="DeFi Protocol Rankings - TVL & Revenue - DefiLlama"
			description="Complete directory of 7000+ DeFi protocols ranked by TVL, fees, and revenue. Track protocol metrics across Ethereum, Solana, Base, Arbitrum and all major chains. Filter by category, chain, and performance."
			canonicalUrl="/protocols"
			tvlOptions={protocolTvlOptions}
		>
			<ChainProtocolsTable protocols={protocols} protocolRankings={protocolRankings} headingAs="h1" />
		</Layout>
	)
}
