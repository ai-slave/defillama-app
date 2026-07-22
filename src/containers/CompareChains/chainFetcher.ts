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
	const chainOverviewData = await getChainOverviewData({
		chain,
		chainMetadata,
		protocolMetadata,
		categoriesAndTagsMetadata,
		tokenDirectory
	})

	return { chainOverviewData: chainOverviewData || null }
}
