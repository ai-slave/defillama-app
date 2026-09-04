import type { IChainMetadata } from '~/utils/metadata/types'
import type { ChainsAssetsFlows1dResponse, ChainsAssetTotalsResponse } from './api.types'

/** Reconcile producer-internal flow keys to the display names used by the asset totals response. */
export function reconcileChainAssetFlowKeys({
	assets,
	flows,
	chainMetadata
}: {
	assets: ChainsAssetTotalsResponse
	flows: ChainsAssetsFlows1dResponse
	chainMetadata: Record<string, IChainMetadata>
}): ChainsAssetsFlows1dResponse {
	const metadataByDisplayName = new Map<string, IChainMetadata>()
	for (const metadataKey in chainMetadata) {
		const metadata = chainMetadata[metadataKey]
		if (metadata === undefined) continue
		metadataByDisplayName.set(metadata.name.toLowerCase(), metadata)
	}

	const candidates = new Map<string, string>()
	for (const assetName in assets) {
		candidates.set(assetName.toLowerCase(), assetName)
		const metadata = metadataByDisplayName.get(assetName.toLowerCase())
		if (metadata) candidates.set(metadata.id.toLowerCase(), assetName)
	}

	const reconciled: ChainsAssetsFlows1dResponse = {}
	for (const producerKey in flows) {
		const flow = flows[producerKey]
		if (flow === undefined) continue
		const assetName = candidates.get(producerKey.toLowerCase())
		if (assetName === undefined) continue
		reconciled[assetName] = flow
	}

	return reconciled
}
