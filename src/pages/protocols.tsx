import type { InferGetStaticPropsType } from 'next'
import { tvlOptions } from '~/components/Filters/options'
import { isProtocolListTvlKey } from '~/containers/ProtocolLists/api.types'
import { getProtocolsByChain } from '~/containers/ProtocolRankings/queries.server'
import { ChainProtocolsTable } from '~/containers/ProtocolRankings/Table'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

const protocolTvlOptions = tvlOptions.filter((option) => isProtocolListTvlKey(option.key))

export const getStaticProps = withPerformanceLogging('protocols', async () => {
	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	const protocolData = await getProtocolsByChain({
		chain: 'All',
		chainMetadata: metadataCache.chainMetadata,
		protocolMetadata: metadataCache.protocolMetadata
	})

	if (protocolData === null) throw new Error('The fixed All-protocol listing must resolve')

	return {
		props: {
			protocols: protocolData.protocols
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
