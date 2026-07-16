import { Announcement } from '~/components/Announcement'
import { disclaimer } from '~/containers/Yields/constants'
import BorrowPage from '~/containers/Yields/views/BorrowView'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('yields/borrow', async () => {
	const [{ getBorrowPageMeta }, { acquireYieldsSnapshot }] = await Promise.all([
		import('~/containers/Yields/data/borrowMeta.server'),
		import('~/containers/Yields/server/dataset.server')
	])
	const metadata = await getBorrowPageMeta(await acquireYieldsSnapshot('blocking'))

	return {
		props: metadata,
		revalidate: maxAgeForNext([23])
	}
})

const pageName = ['Yields: Borrow']

export default function YieldsBorrowPage(data) {
	return (
		<Layout
			title="Borrow Markets - Best DeFi Borrow Rates - DefiLlama"
			description="Compare borrow rates, supply APY, LTV and available liquidity across DeFi lending markets, and find optimal collateral to borrow routes."
			canonicalUrl={`/yields/borrow`}
			pageName={pageName}
		>
			<Announcement announcementId="yields-disclaimer" version="2026-03">
				{disclaimer}
			</Announcement>
			<BorrowPage {...data} />
		</Layout>
	)
}
