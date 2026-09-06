import type { NextApiRequest } from 'next'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const {
	fetchAdapterChainChartDataMock,
	fetchAdapterProtocolChartDataMock,
	resolveChainParamMock,
	resolveProtocolParamMock,
	resolveProtocolParamFromMetadataMock,
	fetchChainAssetsChartMock,
	fetchBridgeVolumeByChainMock,
	fetchRaisesMock,
	getStablecoinOverviewChartSeriesMock,
	getProtocolUnlockUsdChartMock,
	metadataCache
} = vi.hoisted(() => ({
	fetchAdapterChainChartDataMock: vi.fn(),
	fetchAdapterProtocolChartDataMock: vi.fn(),
	resolveChainParamMock: vi.fn(),
	resolveProtocolParamMock: vi.fn(),
	resolveProtocolParamFromMetadataMock: vi.fn(),
	fetchChainAssetsChartMock: vi.fn(),
	fetchBridgeVolumeByChainMock: vi.fn(),
	fetchRaisesMock: vi.fn(),
	getStablecoinOverviewChartSeriesMock: vi.fn(),
	getProtocolUnlockUsdChartMock: vi.fn(),
	metadataCache: { emissionsProtocolBySlug: { aave: true } }
}))

vi.mock('~/utils/metadata', () => ({ default: metadataCache }))

vi.mock('~/containers/BridgedTVL/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/containers/BridgedTVL/api')>()),
	fetchChainAssetsChart: fetchChainAssetsChartMock
}))

vi.mock('~/containers/Bridges/api', () => ({
	fetchRawBridgeVolumeByChain: fetchBridgeVolumeByChainMock
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
	resolveProtocolParam: resolveProtocolParamMock,
	resolveProtocolParamFromMetadata: resolveProtocolParamFromMetadataMock
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
	resolveProtocolParamFromMetadataMock.mockReturnValue({
		canonicalSlug: 'aave',
		id: '1',
		metadata: { displayName: 'Aave' }
	})
})

describe('/api/public/chains/charts', () => {
	test('canonicalizes adapter protocol chart requests before fetching', async () => {
		const req = {
			method: 'GET',
			query: { kind: 'adapter-protocol', adapterType: 'fees', protocol: 'Aave V3' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchAdapterProtocolChartDataMock).toHaveBeenCalledWith({ adapterType: 'fees', protocol: 'aave' })
		expect(res.status).toHaveBeenCalledWith(200)
	})

	test('does not fetch adapter protocol charts for unknown protocols', async () => {
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

	test('allows chain-level fees through adapter protocol chart requests', async () => {
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

	test('allows chain-level revenue through adapter protocol chart requests', async () => {
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

	test('does not fetch chain-level fees when the chain metadata flag is missing', async () => {
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

	test('does not use chain fallback for explicit protocol adapter protocol chart requests', async () => {
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

	test('does not use chain fallback for non-chain-level adapter protocol chart requests', async () => {
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

	test('does not use chain fallback for all-chain adapter protocol chart requests', async () => {
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

	test.each(chainNativeProtocolRows)(
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

	test.each(chainNativeProtocolRows)(
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

	test.each([
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

	test('rejects unsupported adapter types before resolving or fetching', async () => {
		const req = {
			method: 'GET',
			query: { kind: 'adapter-chain', adapterType: 'unknown-adapter', chain: 'Base' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(resolveChainParamMock).not.toHaveBeenCalled()
		expect(fetchAdapterChainChartDataMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'Unsupported adapterType' })
	})

	test.each(chainNativeProtocolRows)(
		'does not use chain fallback for explicit protocol $label requests',
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
		}
	)

	test.each(chainNativeProtocolRows)('keeps legacy omitted-entity fallback for $label only', async (row) => {
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

	test.each(appProtocolRows)('does not accept $label through adapter-protocol entity=chain', async (row) => {
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

	test.each(appProtocolRows)('does not use legacy omitted-entity chain fallback for $label', async (row) => {
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

	test.each(chainActivityProtocolRows)('accepts $label as adapter-protocol entity=chain', async (row) => {
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

	test('does not accept Gas Used as adapter-protocol entity=chain', async () => {
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

	test.each(chainActivityProtocolRows)('does not use legacy omitted-entity chain fallback for $label', async (row) => {
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

	test('accepts Bridged TVL chart requests only for chainAssets chains', async () => {
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Hyperliquid L1',
			canonicalSlug: 'hyperliquid-l1',
			metadata: { id: 'hyperliquid', name: 'Hyperliquid L1', chainAssets: true }
		})
		fetchChainAssetsChartMock.mockResolvedValue([{ timestamp: 1_700_000_000, data: { total: 100 } }])
		const req = {
			method: 'GET',
			query: { kind: 'bridged-tvl', chain: 'hyperliquid-l1' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchChainAssetsChartMock).toHaveBeenCalledWith('hyperliquid')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([{ timestamp: 1_700_000_000, data: { total: 100 } }])
	})

	test.each([
		['OP Mainnet', 'optimism'],
		['Avalanche', 'avax'],
		['Gnosis', 'xdai'],
		['ZKsync Era', 'era']
	])('uses the producer chain ID for %s Bridged TVL charts', async (name, id) => {
		resolveChainParamMock.mockResolvedValue({
			canonicalName: name,
			canonicalSlug: name.toLowerCase().replaceAll(' ', '-'),
			metadata: { id, name, chainAssets: true }
		})

		const req = {
			method: 'GET',
			query: { kind: 'bridged-tvl', chain: name }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchChainAssetsChartMock).toHaveBeenCalledWith(id)
	})

	test('does not fetch Bridged TVL charts when chainAssets metadata is missing', async () => {
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

	test('rejects all-chain Bridged TVL chart requests', async () => {
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

	test('returns an upstream error when Bridged TVL historical data is unavailable', async () => {
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Base',
			canonicalSlug: 'base',
			metadata: { id: 'base', name: 'Base', chainAssets: true }
		})
		fetchChainAssetsChartMock.mockRejectedValue(new Error('missing chart'))
		const req = {
			method: 'GET',
			query: { kind: 'bridged-tvl', chain: 'base' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchChainAssetsChartMock).toHaveBeenCalledWith('base')
		expect(res.status).toHaveBeenCalledWith(502)
		expect(res.json).toHaveBeenCalledWith({ error: 'Bridged TVL chart is unavailable upstream' })
	})

	test('loads bridge net inflows with one focused chain-volume request', async () => {
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Base',
			canonicalSlug: 'base',
			metadata: { name: 'Base' }
		})
		fetchBridgeVolumeByChainMock.mockResolvedValue([
			{ date: '1700000000', depositUSD: 100, withdrawUSD: 40, depositTxs: 2, withdrawTxs: 1 },
			{ date: '1700086400', depositUSD: 25, withdrawUSD: 10, depositTxs: 1, withdrawTxs: 1 }
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
			[1_700_000_000, 100, -40],
			[1_700_086_400, 25, -10]
		])
	})

	test('preserves missing bridge legs so clients can distinguish unknown from zero', async () => {
		resolveChainParamMock.mockResolvedValue({
			canonicalName: 'Base',
			canonicalSlug: 'base',
			metadata: { name: 'Base' }
		})
		fetchBridgeVolumeByChainMock.mockResolvedValue([
			{ date: '1700000000', depositUSD: null, withdrawUSD: 4, depositTxs: 0, withdrawTxs: 1 },
			{ date: '1700086400', depositUSD: 0, withdrawUSD: 0, depositTxs: 0, withdrawTxs: 0 },
			{ date: '1700172800', depositUSD: null, withdrawUSD: null, depositTxs: 0, withdrawTxs: 0 }
		])
		const req = {
			method: 'GET',
			query: { kind: 'net-inflows', chain: 'base' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.json).toHaveBeenCalledWith([
			[1_700_000_000, null, -4],
			[1_700_086_400, 0, 0],
			[1_700_172_800, null, null]
		])
	})

	test('trims leading zero token incentive points without changing producer tuples', async () => {
		getProtocolUnlockUsdChartMock.mockResolvedValue([
			[100, 0],
			[200, 5],
			[500, 7],
			[600, 0]
		])
		const req = {
			method: 'GET',
			query: { kind: 'token-incentives', protocol: 'aave' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(getProtocolUnlockUsdChartMock).toHaveBeenCalledWith('aave')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([
			[200, 5],
			[500, 7],
			[600, 0]
		])
	})

	test('preserves a valid empty token incentive chart as a cached empty response', async () => {
		getProtocolUnlockUsdChartMock.mockResolvedValue([])
		const req = {
			method: 'GET',
			query: { kind: 'token-incentives', protocol: 'aave' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([])
		expect(res.setHeader).not.toHaveBeenCalledWith('Cache-Control', 'no-store')
	})

	test('preserves a nonempty all-zero token incentive chart', async () => {
		getProtocolUnlockUsdChartMock.mockResolvedValue([
			[100, 0],
			[200, 0]
		])
		const req = {
			method: 'GET',
			query: { kind: 'token-incentives', protocol: 'aave' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([
			[100, 0],
			[200, 0]
		])
	})

	test('accepts lowercase all for adapter chain charts', async () => {
		const req = {
			method: 'GET',
			query: { kind: 'adapter-chain', adapterType: 'fees', chain: 'all' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchAdapterChainChartDataMock).toHaveBeenCalledWith({ adapterType: 'fees', chain: 'All' })
		expect(res.status).toHaveBeenCalledWith(200)
	})

	test('sorts aggregated raise dates while retaining an explicit zero total', async () => {
		fetchRaisesMock.mockResolvedValue({
			raises: [
				{ date: 3, amountUsd: 0 },
				{ date: 2, amountUsd: 4 },
				{ date: 1, amountUsd: 3 },
				{ date: 2, amountUsd: 1 }
			]
		})
		const req = {
			method: 'GET',
			query: { kind: 'raises' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([
			[1000, 3],
			[2000, 5],
			[3000, 0]
		])
	})

	test('preserves stablecoin chart gaps and zero-valued rows', async () => {
		getStablecoinOverviewChartSeriesMock.mockResolvedValue({
			dataset: {
				dimensions: ['timestamp', 'Total Stablecoins'],
				source: [
					[1000, null],
					[2000, 0]
				]
			}
		})
		const req = {
			method: 'GET',
			query: { kind: 'stablecoins-mcap', chain: 'all' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([
			[1000, null],
			[2000, 0]
		])
	})
})
