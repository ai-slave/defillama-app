import type { InferGetServerSidePropsType } from 'next'
import { Announcement } from '~/components/Announcement'
import { disclaimer } from '~/containers/Yields/constants'
import { loadEarnPageProps } from '~/containers/Yields/server/earnPage.server'
import YieldPage, { type EarnViewProps } from '~/containers/Yields/views/EarnView'
import { YieldsV2ApiAnnouncement } from '~/containers/Yields/YieldsV2ApiAnnouncement'
import Layout from '~/layout'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'

export const getServerSideProps = withServerSidePropsTelemetry<EarnViewProps>('yields', async (context) => ({
	props: await loadEarnPageProps(context, 'yields')
}))

const pageName = ['Yields: Earn']

export default function ApyHomePage(data: InferGetServerSidePropsType<typeof getServerSideProps>) {
	return (
		<Layout
			title="Yield Farming Rankings - Best DeFi APY Pools - DefiLlama"
			description="Find the best DeFi yield farming opportunities across all chains. Compare APY rates, TVL, and pool metrics for 10,000+ yield pools on Ethereum, Solana, Base, and 500+ networks. Real-time yield analytics."
			canonicalUrl="/yields"
			pageName={pageName}
		>
			<Announcement announcementId="yields-disclaimer" version="2026-03">
				{disclaimer}
			</Announcement>
			<YieldsV2ApiAnnouncement />
			<YieldPage {...data} />
		</Layout>
	)
}
