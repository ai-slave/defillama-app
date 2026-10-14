import type { InferGetStaticPropsType } from 'next'
import { tvlOptions } from '~/components/Filters/options'
import { ChainsByCategory } from '~/containers/ChainsByCategory'
import { getChainsByCategory } from '~/containers/ChainsByCategory/queries'
import { fetchEntityQuestions } from '~/containers/LlamaAI/api'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

const pageName = ['Chains']

export const getStaticProps = withPerformanceLogging('chains', async () => {
	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	const data = await getChainsByCategory({
		chainMetadata: metadataCache.chainMetadata,
		category: 'All',
		sampledChart: true,
		includeChartData: false
	})

	const chainsContext = {
		totalChains: data.chains.length,
		topChains: data.chains.slice(0, 15).map((c) => ({
			name: c.name,
			tvl: c.tvl ?? null,
			change_1d: c.change_1d ?? null,
			change_7d: c.change_7d ?? null,
			protocols: c.protocols ?? null,
			dexVolume24h: c.dexVolume24h ?? null,
			fees24h: c.fees24h ?? null,
			revenue24h: c.revenue24h ?? null,
			stablesMcap: c.stablesMcap ?? null
		}))
	}
	const { questions: entityQuestions } = await fetchEntityQuestions('chains', 'page', chainsContext)

	return {
		props: { ...data, entityQuestions },
		revalidate: maxAgeForNext([22])
	}
})

export default function Chains(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Total Value Locked (TVL) by Chain - DefiLlama"
			description="TVL is the dollar value locked in DeFi. Compare total value locked on Ethereum, Solana, and 500+ chains."
			canonicalUrl="/chains"
			tvlOptions={tvlOptions}
			pageName={pageName}
		>
			<ChainsByCategory {...props} />
		</Layout>
	)
}
