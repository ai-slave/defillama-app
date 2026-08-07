import type { InferGetStaticPropsType } from 'next'
import { tvlOptions } from '~/components/Filters/options'
import { isProtocolListTvlKey } from '~/containers/ProtocolLists/api.types'
import { getProtocolRankingsSnapshot } from '~/containers/ProtocolRankings/server/tableData.server'
import { PROTOCOL_RANKING_ACTIVITY_METRIC_KEYS } from '~/containers/ProtocolRankings/sortAccessors'
import { ChainProtocolsTable } from '~/containers/ProtocolRankings/Table'
import type { IChildProtocol, IProtocol } from '~/containers/ProtocolRankings/types'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

const protocolTvlOptions = tvlOptions.filter((option) => isProtocolListTvlKey(option.key))

// The shared snapshot carries extended activity metrics this page's local-mode
// table never renders; strip them so its already-large props payload doesn't grow.
function toBaseRow<Row extends IChildProtocol>(row: Row): Row {
	const base = { ...row }
	for (const key of PROTOCOL_RANKING_ACTIVITY_METRIC_KEYS) delete base[key]
	return base
}

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

	const protocols: IProtocol[] = snapshot.protocols.map((protocol) => ({
		...toBaseRow(protocol),
		...(protocol.childProtocols ? { childProtocols: protocol.childProtocols.map(toBaseRow) } : {})
	}))

	return {
		props: {
			protocols
		},
		revalidate: maxAgeForNext([22])
	}
})

export default function Protocols({ protocols }: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="DeFi Protocol Rankings - TVL & Revenue - DefiLlama"
			description="Complete directory of 7000+ DeFi protocols ranked by TVL, fees, and revenue. Track protocol metrics across Ethereum, Solana, Base, Arbitrum and all major chains. Filter by category, chain, and performance."
			canonicalUrl={`/protocols`}
			tvlOptions={protocolTvlOptions}
		>
			<ChainProtocolsTable protocols={protocols} headingAs="h1" />
		</Layout>
	)
}
