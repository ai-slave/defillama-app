import type { MetadataCache } from '~/utils/metadata/artifactContract'
import type { IProtocolMetadata } from '~/utils/metadata/types'

export type AdapterProtocolVersionMetric =
	| 'fees'
	| 'revenue'
	| 'dexs'
	| 'perps'
	| 'dexAggregators'
	| 'optionsPremiumVolume'
	| 'perpsAggregators'
	| 'bridgeAggregators'

export interface LinkedAdapterProtocolVersion {
	name: string
	metadata: IProtocolMetadata
}

export function getLinkedAdapterProtocolVersions({
	isParentProtocol,
	linkedProtocols,
	protocolMetadata
}: {
	isParentProtocol: boolean
	linkedProtocols: ReadonlyArray<string> | null | undefined
	protocolMetadata: MetadataCache['protocolMetadata']
}): Array<LinkedAdapterProtocolVersion> {
	if (!isParentProtocol || !linkedProtocols) return []

	const linkedProtocolNames = new Set<string>()
	for (let index = 1; index < linkedProtocols.length; index++) {
		const linkedProtocol = linkedProtocols[index]
		if (linkedProtocol !== undefined) linkedProtocolNames.add(linkedProtocol)
	}
	if (linkedProtocolNames.size === 0) return []
	const versions: Array<LinkedAdapterProtocolVersion> = []
	for (const protocolId in protocolMetadata) {
		if (linkedProtocolNames.size === 0) break
		const metadata = protocolMetadata[protocolId]
		const displayName = metadata?.displayName
		if (!metadata || !displayName || !linkedProtocolNames.has(displayName)) continue
		versions.push({ name: displayName, metadata })
		linkedProtocolNames.delete(displayName)
	}
	return versions
}

export function getLinkedAdapterProtocolVersionNames({
	versions,
	metric
}: {
	versions: ReadonlyArray<LinkedAdapterProtocolVersion>
	metric: AdapterProtocolVersionMetric
}): Array<string> {
	const names: Array<string> = []
	for (const version of versions) {
		if (version.metadata[metric]) names.push(version.name)
	}
	return names
}
