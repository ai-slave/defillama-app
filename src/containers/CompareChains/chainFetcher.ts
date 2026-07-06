import { getAdapterChainOverview, getAdapterProtocolOverview } from '~/containers/AdapterMetrics/queries'
import { getChainOverviewData } from '~/containers/ChainOverview/queries.server'
import type { ICategoriesAndTags, IChainMetadata, IProtocolMetadata } from '~/utils/metadata/types'
import type { TokenDirectory } from '~/utils/tokenDirectory'

export const fetchChain = async ({
	chain,
	chainMetadata,
	categoriesAndTagsMetadata,
	protocolMetadata,
	tokenDirectory = null
}: {
	chain: string
	chainMetadata: Record<string, IChainMetadata>
	categoriesAndTagsMetadata: ICategoriesAndTags
	protocolMetadata: Record<string, IProtocolMetadata>
	tokenDirectory?: TokenDirectory | null
}) => {
	const [chainOverviewData, dexVolumeData, chainFeesData, chainRevenueData] = await Promise.all([
		getChainOverviewData({
			chain,
			chainMetadata,
			protocolMetadata,
			categoriesAndTagsMetadata,
			tokenDirectory
		}),
		getAdapterChainOverview({
			adapterType: 'dexs',
			chain,
			excludeTotalDataChart: false
		}),
		getAdapterProtocolOverview({
			adapterType: 'fees',
			protocol: chain,
			excludeTotalDataChart: false
		}).catch(() => null),
		getAdapterProtocolOverview({
			adapterType: 'fees',
			protocol: chain,
			excludeTotalDataChart: false,
			dataType: 'dailyRevenue'
		}).catch(() => null)
	])

	return {
		chainOverviewData: chainOverviewData || null,
		dexVolumeChart: dexVolumeData?.totalDataChart ?? null,
		chainFeesChart: chainFeesData?.totalDataChart ?? null,
		chainRevenueChart: chainRevenueData?.totalDataChart ?? null
	}
}
