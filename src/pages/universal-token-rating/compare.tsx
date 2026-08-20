import type { InferGetStaticPropsType } from 'next'
import { UtrAccessGate } from '~/containers/UniversalTokenRating/AccessGate'
import { CompareTokens } from '~/containers/UniversalTokenRating/CompareTokens'
import { fetchUtrUniverseWithLive } from '~/containers/UniversalTokenRating/server'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('universal-token-rating/compare', async () => {
	return {
		props: { universe: await fetchUtrUniverseWithLive() },
		revalidate: maxAgeForNext([22])
	}
})

export default function UniversalTokenRatingComparePage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Compare Tokens - Universal Token Rating - DefiLlama"
			description="Compare Universal Token Rating scores between two tokens."
			canonicalUrl="/universal-token-rating/compare"
			pageName={['Universal Token Rating', 'Compare']}
		>
			<UtrAccessGate>
				<CompareTokens universe={props.universe} />
			</UtrAccessGate>
		</Layout>
	)
}
