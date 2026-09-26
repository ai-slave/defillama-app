/** Typed Liquidations reads and pure page transforms over one immutable snapshot. */
import type { BlockExplorersResponse } from '~/api/types'
import type {
	LiquidationsChainPageProps,
	LiquidationsOverviewPageProps,
	LiquidationsProtocolPageProps,
	RawAllLiquidationsResponse,
	RawProtocolsResponse,
	TokenLiquidationsSectionData
} from '~/containers/LiquidationsV2/api.types'
import { createProtocolMetadataLookup } from '~/containers/LiquidationsV2/protocolMetadata'
import {
	buildLiquidationsChainPageData,
	buildLiquidationsOverviewPageData,
	buildLiquidationsProtocolPageData,
	buildTokenLiquidationsSectionData,
	hasTokenLiquidationsData as hasTokenLiquidationsInSnapshot,
	resolveChainId,
	resolveProtocolId,
	type LiquidationsMetadataCache
} from '~/containers/LiquidationsV2/queries'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import { acquireDatasetSnapshot } from '~/server/datasetSnapshots/refresh.server'
import type { DatasetSnapshotHandle } from '~/server/datasetSnapshots/store'

const LIQUIDATIONS_FILES = DATASET_SNAPSHOT_CONTRACT.liquidations.files

async function acquireLiquidationsSnapshot(): Promise<DatasetSnapshotHandle> {
	return (await acquireDatasetSnapshot('liquidations', 'blocking')).handle
}

function readProtocols(snapshot: DatasetSnapshotHandle): Promise<RawProtocolsResponse> {
	return snapshot.readJson(LIQUIDATIONS_FILES.rawProtocols)
}

function readAllLiquidations(snapshot: DatasetSnapshotHandle): Promise<RawAllLiquidationsResponse> {
	return snapshot.readJson(LIQUIDATIONS_FILES.rawAll)
}

function readBlockExplorers(snapshot: DatasetSnapshotHandle): Promise<BlockExplorersResponse> {
	return snapshot.readJson(LIQUIDATIONS_FILES.rawBlockExplorers)
}

export async function getLiquidationsProtocolsList(): Promise<RawProtocolsResponse> {
	return readProtocols(await acquireLiquidationsSnapshot())
}

export type LiquidationsSitemapProtocolChains = Array<{
	protocolId: string
	chainIds: Array<string>
}>

export async function getLiquidationsSitemapProtocolChains(): Promise<LiquidationsSitemapProtocolChains> {
	const snapshot = await acquireLiquidationsSnapshot()
	const [protocolsResponse, allResponse] = await Promise.all([readProtocols(snapshot), readAllLiquidations(snapshot)])
	const result = new Array<LiquidationsSitemapProtocolChains[number]>(protocolsResponse.protocols.length)

	for (let protocolIndex = 0; protocolIndex < protocolsResponse.protocols.length; protocolIndex += 1) {
		const protocolId = protocolsResponse.protocols[protocolIndex]!
		const chainIds: Array<string> = []
		const protocolData = allResponse.data[protocolId]
		if (protocolData) {
			for (const chainId in protocolData) chainIds.push(chainId)
		}
		result[protocolIndex] = { protocolId, chainIds }
	}

	return result
}

export async function getLiquidationsOverviewPageData(
	metadataCache: LiquidationsMetadataCache
): Promise<LiquidationsOverviewPageProps> {
	const snapshot = await acquireLiquidationsSnapshot()
	const [protocolsResponse, allResponse] = await Promise.all([readProtocols(snapshot), readAllLiquidations(snapshot)])
	return buildLiquidationsOverviewPageData(protocolsResponse, allResponse, metadataCache)
}

export async function getTokenLiquidationsSectionData(
	tokenSymbol: string,
	metadataCache: LiquidationsMetadataCache
): Promise<TokenLiquidationsSectionData | null> {
	const snapshot = await acquireLiquidationsSnapshot()
	const [protocolsResponse, allResponse] = await Promise.all([readProtocols(snapshot), readAllLiquidations(snapshot)])
	return buildTokenLiquidationsSectionData(tokenSymbol, protocolsResponse, allResponse, metadataCache)
}

export async function hasTokenLiquidationsData(tokenSymbol: string): Promise<boolean> {
	const snapshot = await acquireLiquidationsSnapshot()
	const [protocolsResponse, allResponse] = await Promise.all([readProtocols(snapshot), readAllLiquidations(snapshot)])
	return hasTokenLiquidationsInSnapshot(tokenSymbol, protocolsResponse, allResponse)
}

function resolveSnapshotProtocolId(
	protocolParam: string,
	protocolsResponse: RawProtocolsResponse,
	metadataCache: LiquidationsMetadataCache
): string | null {
	return resolveProtocolId(
		protocolParam,
		protocolsResponse.protocols,
		createProtocolMetadataLookup(metadataCache.protocolMetadata)
	)
}

export async function getLiquidationsProtocolPageData(
	protocolParam: string,
	metadataCache: LiquidationsMetadataCache
): Promise<LiquidationsProtocolPageProps | null> {
	const snapshot = await acquireLiquidationsSnapshot()
	const [protocolsResponse, allResponse, blockExplorers] = await Promise.all([
		readProtocols(snapshot),
		readAllLiquidations(snapshot),
		readBlockExplorers(snapshot)
	])
	const protocolId = resolveSnapshotProtocolId(protocolParam, protocolsResponse, metadataCache)
	if (!protocolId) return null

	const protocolData = allResponse.data[protocolId]
	if (!protocolData) return null

	return buildLiquidationsProtocolPageData(
		protocolId,
		protocolsResponse.protocols,
		protocolData,
		allResponse.timestamp,
		blockExplorers,
		metadataCache
	)
}

export async function getLiquidationsChainPageData(
	protocolParam: string,
	chainParam: string,
	metadataCache: LiquidationsMetadataCache
): Promise<LiquidationsChainPageProps | null> {
	const snapshot = await acquireLiquidationsSnapshot()
	const [protocolsResponse, allResponse, blockExplorers] = await Promise.all([
		readProtocols(snapshot),
		readAllLiquidations(snapshot),
		readBlockExplorers(snapshot)
	])
	const protocolId = resolveSnapshotProtocolId(protocolParam, protocolsResponse, metadataCache)
	if (!protocolId) return null

	const protocolData = allResponse.data[protocolId]
	if (!protocolData) return null

	const chainIds: Array<string> = []
	for (const currentChainId in protocolData) chainIds.push(currentChainId)
	const chainId = resolveChainId(chainParam, chainIds, metadataCache.chainMetadata)
	if (!chainId) return null

	return buildLiquidationsChainPageData(
		protocolId,
		chainId,
		protocolsResponse.protocols,
		protocolData,
		allResponse.timestamp,
		blockExplorers,
		metadataCache
	)
}
