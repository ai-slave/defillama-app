import type { InferGetStaticPropsType } from 'next'
import { IndustriesPage } from '~/containers/Equities/IndustriesPage'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('equities/industries', async () => {
	const { loadEquitiesIndustriesPageData } = await import('~/containers/Equities/server/marketData.server')
	return {
		props: { state: await loadEquitiesIndustriesPageData() },
		revalidate: maxAgeForNext([5])
	}
})

export default function EquityIndustriesRoute({ state }: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Equity Industries - DefiLlama"
			description="Explore US equity industries by market capitalization, company count, sector share, valuation, and performance."
			canonicalUrl="/equities/industries"
			pageName={['Equity Industries']}
		>
			<IndustriesPage state={state} />
		</Layout>
	)
}
