import type { InferGetStaticPropsType } from 'next'
import { Announcement } from '~/components/Announcement'
import { fetchEntityQuestions } from '~/containers/LlamaAI/api'
import { disclaimer } from '~/containers/Yields/constants'
import EarnView, { type EarnViewProps } from '~/containers/Yields/views/EarnView'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

// The subject of this route. Seeds the ISR rows AND locks the live query, so the
// page is a stablecoin document rather than /yields with a filter chip set.
const STABLECOIN_QUERY = { stablecoin: 'true', noIlRisk: 'true' } as const

export const getStaticProps = withPerformanceLogging<EarnViewProps>('yields/stablecoins', async () => {
	const [{ getEarnPageMeta }, { getEarnPage }, { acquireYieldsSnapshot }] = await Promise.all([
		import('~/containers/Yields/data/earnMeta.server'),
		import('~/containers/Yields/data/earn.server'),
		import('~/containers/Yields/server/dataset.server')
	])
	const snapshot = await acquireYieldsSnapshot('blocking')
	const [metadata, initialEarnPage, { questions: entityQuestions }] = await Promise.all([
		getEarnPageMeta(snapshot),
		getEarnPage(snapshot, { ...STABLECOIN_QUERY }),
		fetchEntityQuestions('yields', 'page')
	])

	return {
		props: {
			...metadata,
			// The two locked attributes are the route itself - offering them as
			// toggles would let the page filter its own subject away.
			attributeIds: metadata.attributeIds.filter((id) => id !== 'stablecoins' && id !== 'no_il'),
			entityQuestions,
			initialEarnPage,
			initialEarnPageGeneratedAt: snapshot.generatedAt
		},
		revalidate: maxAgeForNext([23])
	}
})

const pageName = ['Stablecoin Yields']

export default function StablecoinYieldsPage(data: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Best Stablecoin Yields - USDC, USDT & DAI APY Rankings - DefiLlama"
			description="Compare the best stablecoin yields across DeFi. Live APY, TVL and risk data for USDC, USDT, DAI and other stablecoin pools with no impermanent loss, across 500+ chains."
			canonicalUrl="/yields/stablecoins"
			pageName={pageName}
		>
			<Announcement announcementId="yields-disclaimer" version="2026-03">
				{disclaimer}
			</Announcement>
			<EarnView
				{...data}
				lockedQuery={{ ...STABLECOIN_QUERY }}
				intro={
					<p className="rounded-lg border border-subtle bg-surface p-4 body-sm text-secondary">
						Stablecoin pools pay yield on dollar-pegged assets, so returns come from lending demand, trading fees and
						incentives rather than token price movement. Every pool below holds only stablecoins and carries no
						impermanent loss. APY, TVL and pool counts update daily - sort by APY for the highest headline rate, or by
						TVL to weight toward pools with the deepest liquidity.
					</p>
				}
			/>
		</Layout>
	)
}
