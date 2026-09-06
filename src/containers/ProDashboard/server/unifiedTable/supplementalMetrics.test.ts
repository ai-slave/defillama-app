import { describe, expect, test, vi } from 'vitest'
import type { DimensionDatasetProtocol } from '~/containers/AdapterMetrics/datasetTypes'
import type { ProtocolAggregateTableRow, ProtocolChainTableRow } from '../../unifiedTable/contracts'

const { fetchDimensionDatasetMock } = vi.hoisted(() => ({ fetchDimensionDatasetMock: vi.fn() }))

vi.mock('~/containers/AdapterMetrics/server/datasets', async (importOriginal) => {
	const original = await importOriginal<typeof import('~/containers/AdapterMetrics/server/datasets')>()
	return { ...original, fetchDimensionDataset: fetchDimensionDatasetMock }
})

import { applyProtocolSupplementalMetrics, fetchProtocolSupplementalMetrics } from './supplementalMetrics'

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

function chainRow(protocolId: string, chain: string): ProtocolChainTableRow {
	return {
		...protocolRow(protocolId, null),
		rowType: 'protocol-chain',
		id: `${protocolId}-${chain}`,
		chains: [chain],
		chain
	}
}

function datasetProtocol(overrides: Partial<DimensionDatasetProtocol>): DimensionDatasetProtocol {
	return { name: 'Protocol', slug: 'protocol', chains: [], ...overrides }
}

describe('fetchProtocolSupplementalMetrics', () => {
	test('returns successful chain values with explicit partial coverage', async () => {
		fetchDimensionDatasetMock.mockResolvedValueOnce({
			status: 'partial',
			protocols: [datasetProtocol({ total24h: 20 })],
			unavailableChains: ['Base']
		})

		await expect(
			fetchProtocolSupplementalMetrics(['earnings'], { kind: 'chain', chains: ['Ethereum', 'Base'] })
		).resolves.toMatchObject({
			earnings: { status: 'partial', protocols: [{ total24h: 20 }], unavailableChains: ['Base'] }
		})
	})
})

describe('applyProtocolSupplementalMetrics', () => {
	test('merges onto Lens membership without introducing API-only rows or copying a parent total to children', () => {
		const rows = [protocolRow('aave-v2', 'aave'), protocolRow('aave-v3', 'aave'), protocolRow('solo', null)]
		const result = applyProtocolSupplementalMetrics(
			rows,
			{ aave: { mcap: null, fdv: null } },
			{
				earnings: {
					status: 'complete',
					protocols: [
						datasetProtocol({ slug: 'aave', total24h: 100, total7d: 700, total30d: 3000, total1y: 36_500 }),
						datasetProtocol({ slug: 'solo', total24h: 10 }),
						datasetProtocol({ slug: 'api-only', total24h: 999 })
					]
				}
			}
		)

		expect(result.rows).toHaveLength(3)
		expect(result.rows[0]?.metrics.earnings24h).toBeUndefined()
		expect(result.rows[1]?.metrics.earnings24h).toBeUndefined()
		expect(result.rows[2]?.metrics.earnings24h).toBe(10)
		expect(result.parentMetrics.aave?.supplements?.earnings).toMatchObject({
			childProtocolIds: ['aave-v2', 'aave-v3'],
			metrics: { earnings24h: 100, earnings7d: 700, earnings30d: 3000, earnings1y: 36_500 }
		})
	})

	test('assigns selected-chain values only to the matching protocol-chain row', () => {
		const result = applyProtocolSupplementalMetrics(
			[chainRow('protocol', 'Ethereum'), chainRow('protocol', 'Base')],
			{},
			{
				earnings: {
					status: 'complete',
					protocols: [
						datasetProtocol({
							total24h: 30,
							chainBreakdown: {
								ethereum: { ...datasetProtocol({ total24h: 20 }), chain: 'Ethereum' },
								base: { ...datasetProtocol({ total24h: 10 }), chain: 'Base' }
							}
						})
					]
				}
			}
		)

		expect(result.rows.map((row) => row.metrics.earnings24h)).toEqual([20, 10])
	})

	test('calculates bridge aggregator dominance with canonical chain aliases', () => {
		const result = applyProtocolSupplementalMetrics(
			[chainRow('protocol', 'OP Mainnet'), chainRow('other', 'OP Mainnet')],
			{},
			{
				bridgeAggregatorVolume: {
					status: 'complete',
					protocols: [
						datasetProtocol({
							total24h: 20,
							chainBreakdown: {
								'op mainnet': { ...datasetProtocol({ total24h: 20 }), chain: 'OP Mainnet' }
							}
						}),
						datasetProtocol({
							slug: 'other',
							total24h: 80,
							chainBreakdown: {
								'op-mainnet': {
									...datasetProtocol({ slug: 'other', total24h: 80 }),
									chain: 'OP Mainnet'
								}
							}
						})
					]
				}
			}
		)

		expect(result.rows.map((row) => row.metrics.bridgeAggregatorVolumeDominance24h)).toEqual([20, 80])
	})

	test('retains successful chain supplements without publishing an incomplete aggregate', () => {
		const ethereum = chainRow('protocol', 'Ethereum')
		const base = chainRow('protocol', 'Base')
		const result = applyProtocolSupplementalMetrics(
			[ethereum, base],
			{},
			{
				earnings: {
					status: 'partial',
					unavailableChains: ['Base'],
					protocols: [
						datasetProtocol({
							total24h: 20,
							chainBreakdown: {
								ethereum: { ...datasetProtocol({ total24h: 20 }), chain: 'Ethereum' }
							}
						})
					]
				}
			}
		)

		expect(result.rows.map((row) => row.metrics.earnings24h)).toEqual([20, undefined])
	})

	test('retains the full parent-child relation when supplementing a filtered row subset', () => {
		const visibleChild = protocolRow('aave-v2', 'aave')
		const hiddenChild = protocolRow('aave-v3', 'aave')
		const result = applyProtocolSupplementalMetrics(
			[visibleChild],
			{ aave: { mcap: null, fdv: null } },
			{
				earnings: {
					status: 'complete',
					protocols: [datasetProtocol({ slug: 'aave', total24h: 100 })]
				}
			},
			[visibleChild, hiddenChild]
		)

		expect(result.rows).toEqual([visibleChild])
		expect(result.parentMetrics.aave?.supplements?.earnings?.childProtocolIds).toEqual(['aave-v2', 'aave-v3'])
	})
})
