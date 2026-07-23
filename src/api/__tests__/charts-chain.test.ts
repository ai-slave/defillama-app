import type { NextApiRequest } from 'next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const {
	fetchAdapterChainChartDataMock,
	fetchAdapterProtocolChartDataMock,
	resolveChainParamMock,
	resolveProtocolParamMock,
	fetchChainAssetsChartMock,
	fetchBridgeVolumeByChainMock,
	fetchRaisesMock,
	getStablecoinOverviewChartSeriesMock,
	getProtocolUnlockUsdChartMock
} = vi.hoisted(() => ({
	fetchAdapterChainChartDataMock: vi.fn(),
	fetchAdapterProtocolChartDataMock: vi.fn(),
	resolveChainParamMock: vi.fn(),
	resolveProtocolParamMock: vi.fn(),
	fetchChainAssetsChartMock: vi.fn(),
	fetchBridgeVolumeByChainMock: vi.fn(),
	fetchRaisesMock: vi.fn(),
	getStablecoinOverviewChartSeriesMock: vi.fn(),
	getProtocolUnlockUsdChartMock: vi.fn()
}))

vi.mock('~/containers/BridgedTVL/api', () => ({
	fetchChainAssetsChart: fetchChainAssetsChartMock
}))

vi.mock('~/containers/Bridges/api', () => ({
	fetchBridgeVolumeByChain: fetchBridgeVolumeByChainMock
}))

vi.mock('~/containers/AdapterMetrics/api', () => ({
	fetchAdapterChainChartData: fetchAdapterChainChartDataMock,
	fetchAdapterProtocolChartData: fetchAdapterProtocolChartDataMock
}))

vi.mock('~/containers/Raises/api', () => ({
	fetchRaises: fetchRaisesMock
}))

vi.mock('~/containers/Stablecoins/queries.server', () => ({
	getStablecoinOverviewChartSeries: getStablecoinOverviewChartSeriesMock
}))

vi.mock('~/containers/Unlocks/queries', () => ({
	getProtocolUnlockUsdChart: getProtocolUnlockUsdChartMock
}))

vi.mock('~/containers/ProtocolOverview/server/routes', () => ({
	resolveProtocolParam: resolveProtocolParamMock
}))

vi.mock('~/containers/ChainOverview/server/routes', () => ({
	resolveChainParam: resolveChainParamMock
}))

import handler from '~/pages/api/public/chains/charts'

beforeEach(() => {
	vi.clearAllMocks()
	fetchAdapterChainChartDataMock.mockResolvedValue([])
	fetchAdapterProtocolChartDataMock.mockResolvedValue([])
	fetchChainAssetsChartMock.mockResolvedValue([])
	fetchBridgeVolumeByChainMock.mockResolvedValue([])
	resolveChainParamMock.mockResolvedValue(null)
	resolveProtocolParamMock.mockResolvedValue({ canonicalSlug: 'aave', id: '1', metadata: { displayName: 'Aave' } })
})

describe('/api/public/chains/charts', () => {
	it('canonicalizes adapter protocol chart requests before fetching', async () => {
		const req = {
			method: 'GET',
			query: { kind: 'adapter-protocol', adapterType: 'fees', protocol: 'Aave V3' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchAdapterProtocolChartDataMock).toHaveBeenCalledWith({ adapterType: 'fees', protocol: 'aave' })
		expect(res.status).toHaveBeenCalledWith(200)
	})

	it('does not fetch adapter protocol charts for unknown protocols', async () => {
		resolveProtocolParamMock.mockResolvedValue(null)
		resolveChainParamMock.mockResolvedValue(null)
		const req = {
			method: 'GET',
			query: { kind: 'adapter-protocol', adapterType: 'fees', protocol: 'missing' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchAdapterProtocolChartDataMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'protocol not found' })
	})

	it('allows chain-level fees through adapter protocol chart requests', async () => {
		resolveProtocolParamMock.mockResolvedValue(null)
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Hyperliquid L1',
			canonicalSlug: 'hyperliquid-l1',
			metadata: { name: 'Hyperliquid L1', chainFees: true }
		})
		const req = {
			method: 'GET',
			query: { kind: 'adapter-protocol', entity: 'chain', adapterType: 'fees', protocol: 'hyperliquid-l1' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(resolveProtocolParamMock).not.toHaveBeenCalled()
		expect(fetchAdapterProtocolChartDataMock).toHaveBeenCalledWith({
			adapterType: 'fees',
			protocol: 'Hyperliquid L1'
		})
		expect(res.status).toHaveBeenCalledWith(200)
	})

	it('allows chain-level revenue through adapter protocol chart requests', async () => {
		resolveProtocolParamMock.mockResolvedValue(null)
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Sui',
			canonicalSlug: 'sui',
			metadata: { name: 'Sui', chainRevenue: true }
		})
		const req = {
			method: 'GET',
			query: {
				kind: 'adapter-protocol',
				entity: 'chain',
				adapterType: 'fees',
				protocol: 'Sui',
				dataType: 'dailyRevenue'
			}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(resolveProtocolParamMock).not.toHaveBeenCalled()
		expect(fetchAdapterProtocolChartDataMock).toHaveBeenCalledWith({
			adapterType: 'fees',
			protocol: 'Sui',
			dataType: 'dailyRevenue'
		})
		expect(res.status).toHaveBeenCalledWith(200)
	})

	it('does not fetch chain-level fees when the chain metadata flag is missing', async () => {
		resolveProtocolParamMock.mockResolvedValue(null)
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Base',
			canonicalSlug: 'base',
			metadata: { name: 'Base' }
		})
		const req = {
			method: 'GET',
			query: { kind: 'adapter-protocol', entity: 'chain', adapterType: 'fees', protocol: 'Base' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchAdapterProtocolChartDataMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'protocol not found' })
	})

	it('does not use chain fallback for explicit protocol adapter protocol chart requests', async () => {
		resolveProtocolParamMock.mockResolvedValue(null)
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Base',
			canonicalSlug: 'base',
			metadata: { name: 'Base', chainFees: true }
		})
		const req = {
			method: 'GET',
			query: { kind: 'adapter-protocol', entity: 'protocol', adapterType: 'fees', protocol: 'Base' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(resolveChainParamMock).not.toHaveBeenCalled()
		expect(fetchAdapterProtocolChartDataMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'protocol not found' })
	})

	it('does not use chain fallback for non-chain-level adapter protocol chart requests', async () => {
		resolveProtocolParamMock.mockResolvedValue(null)
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Base',
			canonicalSlug: 'base',
			metadata: { name: 'Base', chainFees: true }
		})
		const req = {
			method: 'GET',
			query: {
				kind: 'adapter-protocol',
				entity: 'chain',
				adapterType: 'fees',
				protocol: 'Base',
				dataType: 'dailyAppFees'
			}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(resolveChainParamMock).not.toHaveBeenCalled()
		expect(fetchAdapterProtocolChartDataMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'protocol not found' })
	})

	it('does not use chain fallback for all-chain adapter protocol chart requests', async () => {
		resolveProtocolParamMock.mockResolvedValue(null)
		const req = {
			method: 'GET',
			query: { kind: 'adapter-protocol', entity: 'chain', adapterType: 'fees', protocol: 'All' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(resolveChainParamMock).not.toHaveBeenCalled()
		expect(fetchAdapterProtocolChartDataMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'protocol not found' })
	})

	const chainNativeProtocolRows = [
		{ label: 'Chain Fees', metadataFlag: 'chainFees', dataType: undefined },
		{ label: 'Chain Revenue', metadataFlag: 'chainRevenue', dataType: 'dailyRevenue' }
	] as const

	it.each(chainNativeProtocolRows)(
		'accepts $label as adapter-protocol entity=chain only with its metadata flag',
		async (row) => {
			resolveProtocolParamMock.mockResolvedValue(null)
			resolveChainParamMock.mockResolvedValue({
				canonicalName: 'Base',
				canonicalSlug: 'base',
				metadata: { name: 'Base', [row.metadataFlag]: true }
			})
			const req = {
				method: 'GET',
				query: {
					kind: 'adapter-protocol',
					entity: 'chain',
					adapterType: 'fees',
					protocol: 'Base',
					...(row.dataType ? { dataType: row.dataType } : null)
				}
			} as unknown as NextApiRequest
			const res = createMockNextApiResponse()

			await handler(req, res)

			expect(resolveProtocolParamMock).not.toHaveBeenCalled()
			expect(fetchAdapterProtocolChartDataMock).toHaveBeenCalledWith({
				adapterType: 'fees',
				protocol: 'Base',
				...(row.dataType ? { dataType: row.dataType } : null)
			})
			expect(res.status).toHaveBeenCalledWith(200)
		}
	)

	it.each(chainNativeProtocolRows)(
		'rejects $label as adapter-protocol entity=chain when its metadata flag is missing',
		async (row) => {
			resolveProtocolParamMock.mockResolvedValue(null)
			resolveChainParamMock.mockResolvedValue({
				canonicalName: 'Base',
				canonicalSlug: 'base',
				metadata: { name: 'Base' }
			})
			const req = {
				method: 'GET',
				query: {
					kind: 'adapter-protocol',
					entity: 'chain',
					adapterType: 'fees',
					protocol: 'Base',
					...(row.dataType ? { dataType: row.dataType } : null)
				}
			} as unknown as NextApiRequest
			const res = createMockNextApiResponse()

			await handler(req, res)

			expect(fetchAdapterProtocolChartDataMock).not.toHaveBeenCalled()
			expect(res.status).toHaveBeenCalledWith(404)
			expect(res.json).toHaveBeenCalledWith({ error: 'protocol not found' })
		}
	)

	it.each([
		{ kind: 'adapter-chain', entityParam: { chain: 'Base' }, fetchMock: fetchAdapterChainChartDataMock },
		{
			kind: 'adapter-protocol',
			entityParam: { protocol: 'Base', entity: 'chain' },
			fetchMock: fetchAdapterProtocolChartDataMock
		}
	])('rejects unsupported data types for $kind requests', async ({ kind, entityParam, fetchMock }) => {
		const req = {
			method: 'GET',
			query: {
				kind,
				adapterType: 'fees',
				dataType: 'unsupportedDataType',
				...entityParam
			}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'Unsupported adapter dataType' })
	})

	it.each(chainNativeProtocolRows)('does not use chain fallback for explicit protocol $label requests', async (row) => {
		resolveProtocolParamMock.mockResolvedValue(null)
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Base',
			canonicalSlug: 'base',
			metadata: { name: 'Base', [row.metadataFlag]: true }
		})
		const req = {
			method: 'GET',
			query: {
				kind: 'adapter-protocol',
				entity: 'protocol',
				adapterType: 'fees',
				protocol: 'Base',
				...(row.dataType ? { dataType: row.dataType } : null)
			}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(resolveChainParamMock).not.toHaveBeenCalled()
		expect(fetchAdapterProtocolChartDataMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'protocol not found' })
	})

	it.each(chainNativeProtocolRows)('keeps legacy omitted-entity fallback for $label only', async (row) => {
		resolveProtocolParamMock.mockResolvedValue(null)
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Base',
			canonicalSlug: 'base',
			metadata: { name: 'Base', [row.metadataFlag]: true }
		})
		const req = {
			method: 'GET',
			query: {
				kind: 'adapter-protocol',
				adapterType: 'fees',
				protocol: 'Base',
				...(row.dataType ? { dataType: row.dataType } : null)
			}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchAdapterProtocolChartDataMock).toHaveBeenCalledWith({
			adapterType: 'fees',
			protocol: 'Base',
			...(row.dataType ? { dataType: row.dataType } : null)
		})
		expect(res.status).toHaveBeenCalledWith(200)
	})

	const appProtocolRows = [
		{ label: 'App Fees', dataType: 'dailyAppFees' },
		{ label: 'App Revenue', dataType: 'dailyAppRevenue' }
	] as const

	it.each(appProtocolRows)('does not accept $label through adapter-protocol entity=chain', async (row) => {
		resolveProtocolParamMock.mockResolvedValue(null)
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Base',
			canonicalSlug: 'base',
			metadata: { name: 'Base', chainFees: true, chainRevenue: true }
		})
		const req = {
			method: 'GET',
			query: {
				kind: 'adapter-protocol',
				entity: 'chain',
				adapterType: 'fees',
				protocol: 'Base',
				dataType: row.dataType
			}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(resolveChainParamMock).not.toHaveBeenCalled()
		expect(fetchAdapterProtocolChartDataMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'protocol not found' })
	})

	it.each(appProtocolRows)('does not use legacy omitted-entity chain fallback for $label', async (row) => {
		resolveProtocolParamMock.mockResolvedValue(null)
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Base',
			canonicalSlug: 'base',
			metadata: { name: 'Base', chainFees: true, chainRevenue: true }
		})
		const req = {
			method: 'GET',
			query: {
				kind: 'adapter-protocol',
				adapterType: 'fees',
				protocol: 'Base',
				dataType: row.dataType
			}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(resolveChainParamMock).not.toHaveBeenCalled()
		expect(fetchAdapterProtocolChartDataMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'protocol not found' })
	})

	const chainActivityProtocolRows = [
		{ label: 'Active Addresses', adapterType: 'active-users', dataType: undefined },
		{ label: 'New Addresses', adapterType: 'new-users', dataType: undefined },
		{ label: 'Transactions', adapterType: 'active-users', dataType: 'dailyTransactionsCount' }
	] as const

	it.each(chainActivityProtocolRows)('accepts $label as adapter-protocol entity=chain', async (row) => {
		resolveProtocolParamMock.mockResolvedValue(null)
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Ethereum',
			canonicalSlug: 'ethereum',
			metadata: { name: 'Ethereum' }
		})
		const req = {
			method: 'GET',
			query: {
				kind: 'adapter-protocol',
				entity: 'chain',
				adapterType: row.adapterType,
				protocol: 'ethereum',
				...(row.dataType ? { dataType: row.dataType } : null)
			}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(resolveProtocolParamMock).not.toHaveBeenCalled()
		expect(fetchAdapterProtocolChartDataMock).toHaveBeenCalledWith({
			adapterType: row.adapterType,
			protocol: 'Ethereum',
			...(row.dataType ? { dataType: row.dataType } : null)
		})
		expect(res.status).toHaveBeenCalledWith(200)
	})

	it('does not accept Gas Used as adapter-protocol entity=chain', async () => {
		resolveProtocolParamMock.mockResolvedValue(null)
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Ethereum',
			canonicalSlug: 'ethereum',
			metadata: { name: 'Ethereum' }
		})
		const req = {
			method: 'GET',
			query: {
				kind: 'adapter-protocol',
				entity: 'chain',
				adapterType: 'active-users',
				protocol: 'ethereum',
				dataType: 'dailyGasUsed'
			}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(resolveChainParamMock).not.toHaveBeenCalled()
		expect(fetchAdapterProtocolChartDataMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'protocol not found' })
	})

	it.each(chainActivityProtocolRows)('does not use legacy omitted-entity chain fallback for $label', async (row) => {
		resolveProtocolParamMock.mockResolvedValue(null)
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Ethereum',
			canonicalSlug: 'ethereum',
			metadata: { name: 'Ethereum' }
		})
		const req = {
			method: 'GET',
			query: {
				kind: 'adapter-protocol',
				adapterType: row.adapterType,
				protocol: 'ethereum',
				...(row.dataType ? { dataType: row.dataType } : null)
			}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(resolveChainParamMock).not.toHaveBeenCalled()
		expect(fetchAdapterProtocolChartDataMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'protocol not found' })
	})

	it('accepts Bridged TVL chart requests only for chainAssets chains', async () => {
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Hyperliquid L1',
			canonicalSlug: 'hyperliquid-l1',
			metadata: { name: 'Hyperliquid L1', chainAssets: true }
		})
		fetchChainAssetsChartMock.mockResolvedValue([{ timestamp: 1_700_000_000, data: { total: '100' } }])
		const req = {
			method: 'GET',
			query: { kind: 'bridged-tvl', chain: 'hyperliquid-l1' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchChainAssetsChartMock).toHaveBeenCalledWith('hyperliquid-l1')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([{ timestamp: 1_700_000_000, data: { total: '100' } }])
	})

	it('does not fetch Bridged TVL charts when chainAssets metadata is missing', async () => {
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Base',
			canonicalSlug: 'base',
			metadata: { name: 'Base' }
		})
		const req = {
			method: 'GET',
			query: { kind: 'bridged-tvl', chain: 'base' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchChainAssetsChartMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'chain not found' })
	})

	it('rejects all-chain Bridged TVL chart requests', async () => {
		const req = {
			method: 'GET',
			query: { kind: 'bridged-tvl', chain: 'all' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(resolveChainParamMock).not.toHaveBeenCalled()
		expect(fetchChainAssetsChartMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'chain not found' })
	})

	it('returns null when Bridged TVL historical data is unavailable upstream', async () => {
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Base',
			canonicalSlug: 'base',
			metadata: { name: 'Base', chainAssets: true }
		})
		fetchChainAssetsChartMock.mockRejectedValue(new Error('missing chart'))
		const req = {
			method: 'GET',
			query: { kind: 'bridged-tvl', chain: 'base' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchChainAssetsChartMock).toHaveBeenCalledWith('base')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith(null)
	})

	it('loads bridge net inflows with one focused chain-volume request', async () => {
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Base',
			canonicalSlug: 'base',
			metadata: { name: 'Base' }
		})
		fetchBridgeVolumeByChainMock.mockResolvedValue([
			{ date: '1700000000', depositUSD: 100, withdrawUSD: 40 },
			{ date: '1700086400', depositUSD: 25, withdrawUSD: 10 }
		])
		const req = {
			method: 'GET',
			query: { kind: 'net-inflows', chain: 'base' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchBridgeVolumeByChainMock).toHaveBeenCalledOnce()
		expect(fetchBridgeVolumeByChainMock).toHaveBeenCalledWith('Base')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([
			['1700000000', 100, -40],
			['1700086400', 25, -10]
		])
	})

	it('accepts lowercase all for adapter chain charts', async () => {
		const req = {
			method: 'GET',
			query: { kind: 'adapter-chain', adapterType: 'fees', chain: 'all' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchAdapterChainChartDataMock).toHaveBeenCalledWith({ adapterType: 'fees', chain: 'All' })
		expect(res.status).toHaveBeenCalledWith(200)
	})
})
