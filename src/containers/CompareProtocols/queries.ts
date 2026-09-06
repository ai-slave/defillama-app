import { getChainOverviewData } from '~/containers/ChainOverview/queries.server'
import type { CompareProtocolsProps } from './types'

export async function getCompareProtocolsPageData(): Promise<CompareProtocolsProps> {
	const metadataCache = await import('~/utils/metadata').then((m) => m.default)

	const overviewData = await getChainOverviewData({
		chain: 'All',
		chainMetadata: metadataCache.chainMetadata,
		protocolMetadata: metadataCache.protocolMetadata,
		categoriesAndTagsMetadata: metadataCache.categoriesAndTags
	})
	const protocols: CompareProtocolsProps['protocols'] = overviewData?.protocols ?? []

	const protocolsList: Array<{ value: string; label: string; logo: string; score: number }> = []
	for (const protocol of protocols) {
		protocolsList.push({
			value: protocol.name,
			label: protocol.name,
			logo: protocol.logo ?? '',
			score: protocol.tvl?.default?.tvl ?? 0
		})
		for (const childProtocol of protocol.childProtocols ?? []) {
			protocolsList.push({
				value: childProtocol.name,
				label: childProtocol.name,
				logo: childProtocol.logo ?? '',
				score: 1
			})
		}
	}
	protocolsList.sort((a, b) => b.score - a.score)

	return { protocols, protocolsList }
}
