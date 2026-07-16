import { Announcement } from '~/components/Announcement'
import { disclaimer } from '~/containers/Yields/constants'
import LoopingPage from '~/containers/Yields/views/LoopView'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('yields/loop', async () => {
	const [{ getLoopsPageMeta }, { acquireYieldsSnapshot }] = await Promise.all([
		import('~/containers/Yields/data/loopsMeta.server'),
		import('~/containers/Yields/server/dataset.server')
	])
	const metadata = await getLoopsPageMeta(await acquireYieldsSnapshot('blocking'))

	return {
		props: metadata,
		revalidate: maxAgeForNext([23])
	}
})

const pageName = ['Yields: Loop']

export default function YieldsLoopingPage(data) {
	return (
		<Layout
			title="Looping - Leveraged DeFi Yield Strategies - DefiLlama"
			description="Discover looping (recursive leverage) strategies across DeFi lending markets — leverage, looped APY and LTV by asset."
			canonicalUrl={`/yields/loop`}
			pageName={pageName}
		>
			<Announcement announcementId="yields-disclaimer" version="2026-03">
				{disclaimer}
			</Announcement>
			<LoopingPage {...data} />
		</Layout>
	)
}
