import { tvlOptions } from '~/components/Filters/options'
import { CompareProtocols } from '~/containers/CompareProtocols'
import { getCompareProtocolsPageData } from '~/containers/CompareProtocols/queries'
import { COMPARE_PROTOCOL_TVL_KEYS } from '~/containers/CompareProtocols/requestPlan'
import type { CompareProtocolsProps } from '~/containers/CompareProtocols/types'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('comparison', async () => {
	const data = await getCompareProtocolsPageData()
	return {
		props: data,
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Compare Protocols']
const compareProtocolTvlOptionKeys = new Set<string>(COMPARE_PROTOCOL_TVL_KEYS)
const compareProtocolTvlOptions = tvlOptions.filter((option) => compareProtocolTvlOptionKeys.has(option.key))

export default function CompareProtocolsPage({ protocols, protocolsList }: CompareProtocolsProps) {
	return (
		<Layout
			title="Protocol Comparison - DeFi Metrics - DefiLlama"
			description="Compare DeFi protocols side-by-side by TVL, fees, revenue, and user metrics. Analyze protocol performance across chains and categories. Advanced comparison tool for DeFi investment research."
			canonicalUrl={`/compare-protocols`}
			pageName={pageName}
			tvlOptions={compareProtocolTvlOptions}
		>
			<CompareProtocols protocols={protocols} protocolsList={protocolsList} />
		</Layout>
	)
}
