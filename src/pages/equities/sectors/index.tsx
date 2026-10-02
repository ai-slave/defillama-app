import type { InferGetStaticPropsType } from 'next'
import { SectorsPage } from '~/containers/Equities/SectorsPage'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('equities/sectors', async () => {
	const { loadEquitiesSectorsPageData } = await import('~/containers/Equities/server/marketData.server')
	return {
		props: { state: await loadEquitiesSectorsPageData() },
		revalidate: maxAgeForNext([5])
	}
})

export default function EquitySectorsRoute({ state }: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Equity Sectors - DefiLlama"
			description="Compare US equity sectors by market capitalization, performance, trading volume, and valuation."
			canonicalUrl="/equities/sectors"
			pageName={['Equity Sectors']}
		>
			<SectorsPage state={state} />
		</Layout>
	)
}
