import Correlations, { DEFAULT_CORRELATION_TOKEN_IDS } from '~/containers/Correlations'
import { getInitialTokenSearchOptions } from '~/containers/TokenSearch/search'
import type { TokenSearchResult } from '~/containers/TokenSearch/types'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('correlation', async () => {
	const initialTokenOptions = await getInitialTokenSearchOptions(DEFAULT_CORRELATION_TOKEN_IDS)
	return {
		props: {
			initialTokenOptions
		},
		revalidate: maxAgeForNext([22])
	}
})

export default function Compare({ initialTokenOptions }: { initialTokenOptions: Array<TokenSearchResult> }) {
	return (
		<Layout
			title="Crypto Asset Price Correlations - DefiLlama"
			description="Analyze price correlations between crypto assets. Find diversification opportunities with DefiLlama's correlation matrix."
			canonicalUrl="/correlation"
		>
			<Correlations initialTokenOptions={initialTokenOptions} />
		</Layout>
	)
}
