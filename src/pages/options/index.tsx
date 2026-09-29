import { AdapterByChain } from '~/containers/AdapterMetrics/AdapterByChain'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { getAdapterByChainPageData } from '~/containers/AdapterMetrics/queries'
import type { IAdapterByChainPageData } from '~/containers/AdapterMetrics/types'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

const adapterType = ADAPTER_TYPES.OPTIONS
const dataType = ADAPTER_DATA_TYPES.DAILY_PREMIUM_VOLUME
const type = 'Options'

export const getStaticProps = withPerformanceLogging(`${type}/index`, async () => {
	const data = await getAdapterByChainPageData({
		adapterType,
		chain: 'All',
		dataType,
		route: 'options',
		hasOpenInterest: true,
		hasOptionsMetrics: true,
		metricName: 'Options Premium Volume'
	})

	if (!data) throw new Error('Missing page data for route=/options')

	return {
		props: data,
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Protocols', 'ranked by', 'Options Premium Volume']
const defaultSorting = [{ id: 'total7d', desc: true }]

function OptionsOnAllChains(props: IAdapterByChainPageData) {
	return (
		<Layout
			title="Options Exchange Rankings - Premium Volume, Notional Volume & Open Interest - DefiLlama"
			description="Track DeFi options exchanges by premium volume, notional volume and open interest. Compare options trading activity on Derive, Aevo, Paradex and other options protocols."
			canonicalUrl="/options"
			pageName={pageName}
		>
			<AdapterByChain {...props} type={type} defaultSorting={defaultSorting} />
		</Layout>
	)
}

export default OptionsOnAllChains
