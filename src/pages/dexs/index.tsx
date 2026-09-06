import { AdapterByChain } from '~/containers/AdapterMetrics/AdapterByChain'
import { ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import type { CexSpotVolumeSeries } from '~/containers/AdapterMetrics/dexSpotShare'
import { DexSpotShareChart } from '~/containers/AdapterMetrics/DexSpotShareChart'
import { getAdapterByChainPageData } from '~/containers/AdapterMetrics/queries'
import type { IAdapterByChainPageData } from '~/containers/AdapterMetrics/types'
import { loadMasterExchangeDirectory, loadMasterExchangeOverview } from '~/containers/Exchanges/server/master.loaders'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { optionalPageData } from '~/utils/optionalPageData'
import { withPerformanceLogging } from '~/utils/perf'

const adapterType = ADAPTER_TYPES.DEXS
const type = 'DEX Volume'

export const getStaticProps = withPerformanceLogging(`${type}/index`, async () => {
	const [data, cexSpotVolume, cexSpotVenueCount] = await Promise.all([
		getAdapterByChainPageData({
			adapterType,
			chain: 'All',
			route: 'dexs',
			metricName: type
		}),
		optionalPageData<CexSpotVolumeSeries | null>(
			'dex-spot-share-cex-volume',
			async () => {
				const overview = await loadMasterExchangeOverview('all')
				const values = overview.series.cex_spot_volume
				if (!values) throw new Error('Exchange overview is missing CEX spot volume')
				return { days: overview.days, values }
			},
			null
		),
		optionalPageData<number | null>(
			'dex-spot-share-cex-venue-count',
			async () => {
				const directory = await loadMasterExchangeDirectory()
				let count = 0
				for (const venue of directory.rows) {
					if (venue.kind === 'cex' && venue.tracked && venue.segments.spot) count += 1
				}
				return count
			},
			null
		)
	])

	if (!data) throw new Error('Missing page data for route=/dexs')

	return {
		props: { ...data, cexSpotVolume, cexSpotVenueCount },
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Protocols', 'ranked by', type]

interface DexsPageProps extends IAdapterByChainPageData {
	cexSpotVolume: CexSpotVolumeSeries | null
	cexSpotVenueCount: number | null
}

const DexsVolumeOnAllChains = ({ cexSpotVolume, cexSpotVenueCount, ...props }: DexsPageProps) => {
	return (
		<Layout
			title="DEX Volume Rankings - Trading Activity - DefiLlama"
			description="Track DEX swap volume and trading activity across all decentralized exchanges. Compare 24h and 7-day volume on Uniswap, Curve, PancakeSwap, and 500+ spot DEXs. Real-time DEX volume rankings by protocol and chain."
			canonicalUrl="/dexs"
			pageName={pageName}
		>
			<AdapterByChain {...props} type={type}>
				<DexSpotShareChart
					dexVolume={props.chartData}
					cexVolume={cexSpotVolume}
					dexProtocolCount={props.protocols.length}
					cexVenueCount={cexSpotVenueCount}
				/>
			</AdapterByChain>
		</Layout>
	)
}

export default DexsVolumeOnAllChains
