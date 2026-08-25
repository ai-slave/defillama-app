import type { InferGetStaticPropsType } from 'next'
import { PreIpoOverview } from '~/containers/PreIPO'
import { getPreIpoOverviewPageData } from '~/containers/PreIPO/queries'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('pre-ipo/index', async () => {
	const props = await getPreIpoOverviewPageData()
	return { props, revalidate: maxAgeForNext([30]) }
})

export default function PreIpoIndexPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Pre-IPO Company Valuations - DefiLlama"
			description="Track private-company valuations, funding history, capital raised, and markets offering pre-IPO exposure."
			canonicalUrl="/pre-ipo"
			pageName={['Pre-IPO']}
		>
			<PreIpoOverview {...props} />
		</Layout>
	)
}
