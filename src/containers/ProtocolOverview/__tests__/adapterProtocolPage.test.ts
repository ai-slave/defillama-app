import { describe, expect, test } from 'vitest'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import { getLinkedAdapterProtocolVersionNames, getLinkedAdapterProtocolVersions } from '../adapterProtocolPage'

const protocolMetadata: MetadataCache['protocolMetadata'] = {
	'parent#swap': { displayName: 'Swap', fees: true },
	'swap-v2': { displayName: 'Swap V2', fees: true, revenue: true },
	'swap-v3': { displayName: 'Swap V3', dexs: true },
	'swap-v4': { displayName: 'Swap V4', fees: true },
	'swap-notional': { displayName: 'Swap Notional', dexsNotionalVolume: true },
	'missing-display-name': { fees: true }
}

describe('adapter protocol version discovery', () => {
	test('discovers linked children once in metadata order and derives finite metric groups', () => {
		const versions = getLinkedAdapterProtocolVersions({
			isParentProtocol: true,
			linkedProtocols: ['Swap', 'Swap V4', 'Swap V3', 'Swap V2', 'Swap V4'],
			protocolMetadata
		})

		expect(versions.map((version) => version.name)).toEqual(['Swap V2', 'Swap V3', 'Swap V4'])
		expect(getLinkedAdapterProtocolVersionNames({ versions, metric: 'fees' })).toEqual(['Swap V2', 'Swap V4'])
		expect(getLinkedAdapterProtocolVersionNames({ versions, metric: 'revenue' })).toEqual(['Swap V2'])
	})

	test('does not manufacture versions for a child protocol or missing linked data', () => {
		expect(
			getLinkedAdapterProtocolVersions({
				isParentProtocol: false,
				linkedProtocols: ['Swap', 'Swap V2'],
				protocolMetadata
			})
		).toEqual([])
		expect(
			getLinkedAdapterProtocolVersions({
				isParentProtocol: true,
				linkedProtocols: null,
				protocolMetadata
			})
		).toEqual([])
	})
})
