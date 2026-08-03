import { describe, expect, it } from 'vitest'
import type { DimensionDatasetProtocol } from '~/containers/AdapterMetrics/datasetTypes'
import type { ProtocolAggregateTableRow, ProtocolChainTableRow } from '../../unifiedTable/contracts'
import { filterProtocolRowsByDatasetMembership } from './rowMembership'

function protocolRow(protocolId: string, parentProtocolId: string | null): ProtocolAggregateTableRow {
	return {
		rowType: 'protocol',
		id: `protocol-${protocolId}`,
		name: protocolId,
		protocolId,
		displayName: protocolId,
		logo: '',
		category: null,
		chains: [],
		oracles: [],
		parentProtocolId,
		parentProtocolName: parentProtocolId,
		parentProtocolLogo: null,
		metrics: {},
		chain: null
	}
}

function chainRow(protocolId: string, chain: string, parentProtocolId: string | null): ProtocolChainTableRow {
	return {
		...protocolRow(protocolId, parentProtocolId),
		rowType: 'protocol-chain',
		id: `${protocolId}-${chain}`,
		chains: [chain],
		chain
	}
}

function datasetProtocol(overrides: Partial<DimensionDatasetProtocol>): DimensionDatasetProtocol {
	return { name: 'Protocol', slug: 'protocol', chains: [], ...overrides }
}

describe('protocol row membership', () => {
	it('uses canonical dataset membership without treating missing current activity as absence', () => {
		const aaveV2 = protocolRow('aave-v2', 'aave')
		const aaveV3 = protocolRow('aave-v3', 'aave')
		const inactive = protocolRow('inactive', null)
		const unrelated = protocolRow('unrelated', null)
		const dataset = {
			status: 'complete' as const,
			protocols: [
				datasetProtocol({ slug: 'aave', total24h: null }),
				datasetProtocol({ slug: 'inactive', total24h: null })
			]
		}

		expect(filterProtocolRowsByDatasetMembership([aaveV2, aaveV3, inactive, unrelated], dataset)).toEqual([
			aaveV2,
			aaveV3,
			inactive
		])
	})

	it('scopes canonical parent membership to the dataset chain list', () => {
		const ethereum = chainRow('aave-v2', 'Ethereum', 'aave')
		const base = chainRow('aave-v2', 'Base', 'aave')
		const dataset = {
			status: 'complete' as const,
			protocols: [
				datasetProtocol({
					slug: 'aave',
					chains: ['Ethereum']
				})
			]
		}

		expect(filterProtocolRowsByDatasetMembership([ethereum, base], dataset)).toEqual([ethereum])
	})
})
