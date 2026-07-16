import { Announcement } from '~/components/Announcement'
import { disclaimer } from '~/containers/Yields/constants'
import { YieldsWatchlistContainer } from '~/containers/Yields/views/YieldsWatchlistView'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

// Bookmarks are client-only (localStorage) and the saved earn pools are fetched by id
// from the v2 earn route on the client, so the page ships as a static shell.
export const getStaticProps = withPerformanceLogging('yields/watchlist', async () => {
	return {
		props: {},
		revalidate: maxAgeForNext([23])
	}
})

export default function Portfolio() {
	return (
		<Layout
			title={`Your Saved DeFi Yield Pools - DefiLlama`}
			description="Track your saved DeFi yield pools in one place. Monitor APY changes, TVL, and performance for your bookmarked pools on DefiLlama."
			canonicalUrl={`/yields/watchlist`}
		>
			<Announcement announcementId="yields-disclaimer" version="2026-03">
				{disclaimer}
			</Announcement>
			<YieldsWatchlistContainer />
		</Layout>
	)
}
