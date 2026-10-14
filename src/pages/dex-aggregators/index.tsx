import { faqPageNode, jsonLdDocument } from '~/components/SEO'
import { AdapterByChain, dexAggregatorFaq, dexAggregatorIntro } from '~/containers/AdapterMetrics/AdapterByChain'
import { ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { getAdapterByChainPageData } from '~/containers/AdapterMetrics/queries'
import type { IAdapterByChainPageData } from '~/containers/AdapterMetrics/types'
import { usePageClockSec } from '~/hooks/usePageClock'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

const adapterType = ADAPTER_TYPES.AGGREGATORS
const type = 'DEX Aggregator Volume'

export const getStaticProps = withPerformanceLogging(`${type}/index`, async () => {
	const data = await getAdapterByChainPageData({
		adapterType,
		chain: 'All',
		route: 'dex-aggregators',
		metricName: type
	})

	if (!data) throw new Error('Missing page data for route=/dex-aggregators')

	return {
		props: data,
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Protocols', 'ranked by', type]

function DexAggregatorsVolumeOnAllChains(props: IAdapterByChainPageData) {
	const copy = dexAggregatorIntro({
		dateSec: usePageClockSec(),
		total24h: props.total24h,
		protocols: props.protocols
	})
	return (
		<Layout
			title="Top DEX Aggregators: 1inch, Jupiter & CowSwap - DefiLlama"
			description="A DEX aggregator routes swaps across exchanges for a better price. Rank 1inch, Jupiter, CowSwap, and 100+ by volume."
			canonicalUrl="/dex-aggregators"
			pageName={pageName}
			jsonLd={jsonLdDocument([faqPageNode(dexAggregatorFaq(copy.volumeAnswer))])}
		>
			<AdapterByChain {...props} type={type} />
		</Layout>
	)
}

export default DexAggregatorsVolumeOnAllChains
