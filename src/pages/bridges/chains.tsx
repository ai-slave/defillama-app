import type { InferGetStaticPropsType } from 'next'
import { BridgeChainsOverview } from '~/containers/Bridges/BridgeChainsOverview'
import { getBridgeChainsPageData } from '~/containers/Bridges/queries.server'
import Layout from '~/layout'
import { PanelStatus } from '~/ui/Status'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('bridges/chains', async () => {
	const props = await getBridgeChainsPageData()

	return {
		props,
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Bridge Inflows', 'by', 'Chain']

export default function BridgeChains(props: InferGetStaticPropsType<typeof getStaticProps>) {
	if (!props.tableData || props.tableData.length === 0) {
		return (
			<Layout
				title="Bridges Inflows by Chain - DefiLlama"
				description="This bridge chains page is temporarily unavailable and will be back shortly."
				canonicalUrl="/bridges/chains"
				pageName={pageName}
			>
				{/* Static props: the page rebuilds on its revalidate interval, so there is no read here to retry. */}
				<PanelStatus variant="error">Couldn't load bridge chain data.</PanelStatus>
			</Layout>
		)
	}

	return (
		<Layout
			title="Bridges Inflows by Chain - DefiLlama"
			description="Bridge activity by chain, including net flow rankings, deposit and withdrawal data, top tokens, and multi-timeframe comparisons."
			canonicalUrl="/bridges/chains"
			pageName={pageName}
		>
			<BridgeChainsOverview {...props} />
		</Layout>
	)
}
