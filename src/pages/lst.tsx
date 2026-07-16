import { LSTOverview } from '~/containers/LST'
import { getLSTPageData } from '~/containers/LST/queries'
import type { LSTOverviewProps } from '~/containers/LST/types'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('lsd', async () => {
	const { acquireYieldsSnapshot } = await import('~/containers/Yields/server/dataset.server')
	const data = await getLSTPageData(await acquireYieldsSnapshot('blocking'))

	return {
		props: data,
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['LSTs: Overview']

export default function LSTs(props: LSTOverviewProps) {
	return (
		<Layout
			title="Liquid Staking (LST) Rankings - TVL & APY - DefiLlama"
			description="Compare liquid staking protocols by staked ETH, supply APY, market share, ETH peg, and fees. Track LST growth and dominance."
			canonicalUrl={`/lst`}
			pageName={pageName}
		>
			<LSTOverview {...props} />
		</Layout>
	)
}
