import type { InferGetServerSidePropsType } from 'next'
import { Announcement } from '~/components/Announcement'
import { disclaimer } from '~/containers/Yields/constants'
import { loadEarnPageProps } from '~/containers/Yields/server/earnPage.server'
import EarnView, { type EarnViewProps } from '~/containers/Yields/views/EarnView'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'

// The subject of this route. Seeds the ISR rows AND locks the live query, so the
// page is a stablecoin document rather than /yields with a filter chip set.
const STABLECOIN_QUERY = { stablecoin: 'true', noIlRisk: 'true' } as const

export const getServerSideProps = withServerSidePropsTelemetry<EarnViewProps>('yields/stablecoins', async (context) => {
	const props = await loadEarnPageProps(context, 'yields/stablecoins', { ...STABLECOIN_QUERY })
	return {
		props: {
			...props,
			// The two locked attributes are the route itself - offering them as
			// toggles would let the page filter its own subject away.
			attributeIds: props.attributeIds.filter((id) => id !== 'stablecoins' && id !== 'no_il')
		}
	}
})

const pageName = ['Stablecoin Yields']

export default function StablecoinYieldsPage(data: InferGetServerSidePropsType<typeof getServerSideProps>) {
	return (
		<Layout
			title="Best Stablecoin Yields - USDC, USDT & DAI APY Rankings - DefiLlama"
			description="Compare the best stablecoin yields across DeFi. Live APY, TVL and risk data for USDC, USDT, DAI and other stablecoin pools with no impermanent loss, across 500+ chains."
			canonicalUrl="/yields/stablecoins"
			pageName={pageName}
		>
			<Announcement announcementId="yields-disclaimer" version="2026-03">
				{disclaimer}
			</Announcement>
			<EarnView
				{...data}
				lockedQuery={{ ...STABLECOIN_QUERY }}
				intro={
					<Card as="p" padding="sm" className="body-sm text-secondary">
						Stablecoin pools pay yield on dollar-pegged assets, so returns come from lending demand, trading fees and
						incentives rather than token price movement. Every pool below holds only stablecoins and carries no
						impermanent loss. APY, TVL and pool counts update daily - sort by APY for the highest headline rate, or by
						TVL to weight toward pools with the deepest liquidity.
					</Card>
				}
			/>
		</Layout>
	)
}
