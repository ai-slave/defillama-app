import type { InferGetStaticPropsType } from 'next'
import Rewards from '~/containers/Rewards'
import { getRewardsPageData } from '~/containers/Rewards/queries.server'
import type { RewardsPageProps } from '~/containers/Rewards/types'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging<RewardsPageProps>('rewards', async () => ({
	props: await getRewardsPageData(),
	revalidate: maxAgeForNext([22])
}))
const pageName = ['Rewards']

export default function RewardsPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Protocol Rewards & Referral Programs - DefiLlama"
			description="Explore protocol rewards, points, referral programs, and trading contests. Filter by reward type and program status."
			canonicalUrl="/rewards"
			pageName={pageName}
		>
			<Rewards {...props} />
		</Layout>
	)
}
