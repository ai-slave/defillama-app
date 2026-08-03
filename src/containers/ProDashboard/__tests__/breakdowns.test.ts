import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	CHAIN_NATIVE_BREAKDOWN_METRICS,
	getProtocolChainBreakdownRoute,
	NON_ADAPTER_BY_CHAIN_BREAKDOWN_METRICS,
	PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS,
	STREAM_PROTOCOL_SERIES_SKIP_METRICS
} from '~/containers/ProDashboard/utils/breakdownMetrics'
import { resultBody } from '~/server/api/__tests__/resultBody'

const mocks = vi.hoisted(() => ({
	fetchChainsByCategory: vi.fn(),
	fetchAdapterChainMetrics: vi.fn(),
	fetchAdapterProtocolChartData: vi.fn()
}))

vi.mock('~/containers/Chains/api', () => ({
	fetchChainsByCategory: mocks.fetchChainsByCategory
}))

vi.mock('~/containers/AdapterMetrics/api', () => ({
	fetchAdapterChainMetrics: mocks.fetchAdapterChainMetrics,
	fetchAdapterProtocolChartData: mocks.fetchAdapterProtocolChartData
}))

beforeEach(() => {
	vi.clearAllMocks()
	mocks.fetchAdapterChainMetrics.mockResolvedValue({ protocols: [], allChains: [] })
	mocks.fetchAdapterProtocolChartData.mockResolvedValue([])
})

describe('breakdown route partitioning', () => {
	it('rejects oversized chart-builder fan-out before fetching upstream data', async () => {
		const { adapterMetricBreakdown } =
			await import('~/containers/ProDashboard/server/chartBuilder/adapterMetrics/routes')
		const chains = Array.from({ length: 51 }, (_, index) => `Chain ${index}`).join(',')

		await expect(
			adapterMetricBreakdown.handle({
				method: 'GET',
				url: '',
				headers: {},
				query: { metric: 'fees', chains }
			})
		).resolves.toEqual({
			status: 400,
			body: { error: 'chains supports at most 50 values' }
		})
		expect(mocks.fetchAdapterChainMetrics).not.toHaveBeenCalled()
	})

	it('rejects category resolution when any requested category is incomplete', async () => {
		mocks.fetchChainsByCategory.mockImplementation(async (category: string) => {
			if (category === 'EVM') return { chainsUnique: ['Ethereum'] }
			throw new Error('category source failed')
		})
		const { resolveAllowedChainNamesFromCategories } =
			await import('~/containers/ProDashboard/server/chartBuilder/breakdownChains')

		await expect(resolveAllowedChainNamesFromCategories(['EVM', 'Rollups'])).rejects.toThrow('category source failed')
	})

	it('routes by-chain metrics to their owning domains', () => {
		expect(getProtocolChainBreakdownRoute('tvl')).toBe(
			'/api/public/pro-dashboard/chart-builder/protocols/breakdowns/by-chain/tvl'
		)
		expect(getProtocolChainBreakdownRoute('stablecoins')).toBe(
			'/api/public/pro-dashboard/chart-builder/stablecoins/breakdowns/by-chain'
		)
		expect(getProtocolChainBreakdownRoute('chain-fees')).toBe(
			'/api/public/pro-dashboard/chart-builder/chains/breakdowns/by-chain/chain-fees'
		)
		expect(getProtocolChainBreakdownRoute('chain-revenue')).toBe(
			'/api/public/pro-dashboard/chart-builder/chains/breakdowns/by-chain/chain-revenue'
		)
		expect(getProtocolChainBreakdownRoute('fees')).toBe(
			'/api/public/pro-dashboard/chart-builder/adapter-metrics/breakdowns/by-chain/fees'
		)
		expect(getProtocolChainBreakdownRoute('dex-aggregators')).toBe(
			'/api/public/pro-dashboard/chart-builder/adapter-metrics/breakdowns/by-chain/dex-aggregators'
		)
	})

	it('keeps by-chain metric sets explicit by purpose', () => {
		expect(Array.from(CHAIN_NATIVE_BREAKDOWN_METRICS).toSorted()).toEqual(['chain-fees', 'chain-revenue'])
		expect(Array.from(PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS).toSorted()).toEqual([
			'chain-fees',
			'chain-revenue',
			'stablecoins'
		])
		expect(Array.from(NON_ADAPTER_BY_CHAIN_BREAKDOWN_METRICS).toSorted()).toEqual([
			'chain-fees',
			'chain-revenue',
			'stablecoins',
			'tvl'
		])
		expect(Array.from(STREAM_PROTOCOL_SERIES_SKIP_METRICS).toSorted()).toEqual([
			'chain-fees',
			'chain-revenue',
			'stablecoins',
			'tvl'
		])
	})

	it('rejects concrete protocols for chain-native by-chain breakdowns', async () => {
		const { chainNativeByChainBreakdown } = await import('~/containers/ProDashboard/server/chartBuilder/chains')

		await expect(
			chainNativeByChainBreakdown.handle({
				method: 'GET',
				url: '',
				headers: {},
				query: { metric: 'chain-fees', protocol: 'aave' }
			})
		).resolves.toEqual({
			status: 400,
			body: { error: 'chain-fees metric is only available when protocol=All' }
		})
	})

	it('rejects concrete protocols for stablecoin by-chain breakdowns', async () => {
		const { stablecoinByChainBreakdown } = await import('~/containers/ProDashboard/server/chartBuilder/stablecoins')

		await expect(
			stablecoinByChainBreakdown.handle({
				method: 'GET',
				url: '',
				headers: {},
				query: { protocol: 'aave' }
			})
		).resolves.toEqual({
			status: 400,
			body: { error: 'stablecoins metric is only available when protocol=All' }
		})
	})

	it('filters chain-native breakdown categories against overview row slugs, not Dimensions aliases', async () => {
		mocks.fetchChainsByCategory.mockResolvedValue({ chainsUnique: ['OP Mainnet'] })
		mocks.fetchAdapterChainMetrics.mockResolvedValue({
			protocols: [
				{ name: 'OP Mainnet', slug: 'op-mainnet', protocolType: 'chain', total24h: 30 },
				{ name: 'Gnosis', slug: 'gnosis', protocolType: 'chain', total24h: 20 },
				{ name: 'Aave', slug: 'aave', protocolType: 'protocol', total24h: 100 }
			],
			allChains: []
		})
		mocks.fetchAdapterProtocolChartData.mockResolvedValue([
			[1, 10],
			[2, 30]
		])
		const { chainNativeByChainBreakdown } = await import('~/containers/ProDashboard/server/chartBuilder/chains')

		const result = await chainNativeByChainBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: { metric: 'chain-fees', chainCategories: 'EVM', limit: '5' }
		})

		expect(result.status).toBe(200)
		expect(resultBody(result)).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['OP Mainnet'],
				totalChains: 1
			})
		})
	})

	it('normalizes saved legacy chain aliases for chain-native breakdown filters', async () => {
		mocks.fetchAdapterChainMetrics.mockResolvedValue({
			protocols: [
				{ name: 'OP Mainnet', slug: 'op-mainnet', protocolType: 'chain', total24h: 30 },
				{ name: 'Gnosis', slug: 'gnosis', protocolType: 'chain', total24h: 20 },
				{ name: 'BSC', slug: 'bsc', protocolType: 'chain', total24h: 10 }
			],
			allChains: []
		})
		mocks.fetchAdapterProtocolChartData.mockImplementation(async ({ protocol }: { protocol: string }) =>
			protocol === 'op-mainnet'
				? [
						[1, 10],
						[2, 30]
					]
				: [
						[1, 5],
						[2, 20]
					]
		)
		const { chainNativeByChainBreakdown } = await import('~/containers/ProDashboard/server/chartBuilder/chains')

		const result = await chainNativeByChainBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: { metric: 'chain-fees', chains: 'optimism,xdai', limit: '5' }
		})

		expect(result.status).toBe(200)
		expect(resultBody(result)).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['OP Mainnet', 'Gnosis'],
				totalChains: 2
			})
		})
	})

	it('matches chain-native category filters by overview row names when slugs differ', async () => {
		mocks.fetchChainsByCategory.mockResolvedValue({ chainsUnique: ['Abbrev Chain'] })
		mocks.fetchAdapterChainMetrics.mockResolvedValue({
			protocols: [
				{ name: 'Abbrev Chain', slug: 'ac', protocolType: 'chain', total24h: 40 },
				{ name: 'Other Chain', slug: 'other-chain', protocolType: 'chain', total24h: 30 }
			],
			allChains: []
		})
		mocks.fetchAdapterProtocolChartData.mockResolvedValue([
			[1, 20],
			[2, 40]
		])
		const { chainNativeByChainBreakdown } = await import('~/containers/ProDashboard/server/chartBuilder/chains')

		const result = await chainNativeByChainBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: { metric: 'chain-fees', chainCategories: 'Custom', limit: '5' }
		})

		expect(result.status).toBe(200)
		expect(resultBody(result)).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['Abbrev Chain'],
				totalChains: 1
			})
		})
	})
})
