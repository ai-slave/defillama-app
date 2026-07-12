import { Announcement } from '~/components/Announcement'
import { disclaimer } from '~/containers/Yields/constants'
import { PlotsPage } from '~/containers/Yields/views/OverviewChartsView'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('yields/overview', async () => {
	const [{ acquireYieldsSnapshot, readYieldPageData }, { getYieldMedianData }] = await Promise.all([
		import('~/containers/Yields/server/snapshot.reader.server'),
		import('~/containers/Yields/queries.server')
	])
	const snapshot = await acquireYieldsSnapshot('blocking')
	const {
		props: { ...data }
	} = await readYieldPageData(snapshot)
	data.pools = data.pools.filter((p) => p.apy > 0)
	const median = await getYieldMedianData()

	return {
		props: { ...data, median: median.props },
		revalidate: maxAgeForNext([23])
	}
})

const pageName = ['Yields: Overview']

export default function YieldPlots(data) {
	return (
		<Layout
			title={`Overview - DefiLlama Yield`}
			description="Analyze DeFi yield trends, volatility, and APY distributions across all tracked pools."
			canonicalUrl={`/yields/overview`}
			pageName={pageName}
		>
			<Announcement announcementId="yields-disclaimer" version="2026-03">
				{disclaimer}
			</Announcement>
			<PlotsPage {...data} />
		</Layout>
	)
}
