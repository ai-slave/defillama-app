import Correlations from '~/containers/Correlations'
import { getCorrelationTokenOptions } from '~/containers/Correlations/queries'
import type { CorrelationTokenOption } from '~/containers/Correlations/types'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('correlation', async () => {
	const initialTokenOptions = await getCorrelationTokenOptions()
	return {
		props: {
			initialTokenOptions: initialTokenOptions.tokens
		},
		revalidate: maxAgeForNext([22])
	}
})

export default function Compare({ initialTokenOptions }: { initialTokenOptions: CorrelationTokenOption[] }) {
	return (
		<Layout
			title={`Crypto Asset Price Correlations - DefiLlama`}
			description="Analyze price correlations between crypto assets. Find diversification opportunities with DefiLlama's correlation matrix."
			canonicalUrl={`/correlation`}
		>
			<Correlations initialTokenOptions={initialTokenOptions} />
		</Layout>
	)
}
