import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IChainMetadata } from '~/utils/metadata/types'

const mocks = vi.hoisted<{
	fetchAdapterChainMetrics: ReturnType<typeof vi.fn>
	getDimensionAdapterChainEarningsOverview: ReturnType<typeof vi.fn>
	getDimensionChainNameMap: ReturnType<typeof vi.fn>
	metadataCache: { chainMetadata: Record<string, IChainMetadata> }
}>(() => ({
	fetchAdapterChainMetrics: vi.fn(),
	getDimensionAdapterChainEarningsOverview: vi.fn(),
	getDimensionChainNameMap: vi.fn(),
	metadataCache: { chainMetadata: {} }
}))

vi.mock('../api', () => ({ fetchAdapterChainMetrics: mocks.fetchAdapterChainMetrics }))
vi.mock('~/containers/Incentives/queries', async (importOriginal) => {
	const original = await importOriginal<typeof import('~/containers/Incentives/queries')>()
	return {
		...original,
		getDimensionAdapterChainEarningsOverview: mocks.getDimensionAdapterChainEarningsOverview
	}
})
vi.mock('../chainNameMap', () => ({ getDimensionChainNameMap: mocks.getDimensionChainNameMap }))
vi.mock('~/utils/metadata', () => ({ default: mocks.metadataCache }))

import {
	createDimensionDatasetRequestScope,
	DIMENSION_DATASET_REQUEST_CONCURRENCY,
	fetchDimensionDataset,
	getDimensionDatasetSpec
} from '../server/datasets'

const protocol = (name: string, total24h = 10) => ({
	name,
	displayName: name,
	defillamaId: name.toLowerCase(),
	slug: name.toLowerCase(),
	logo: '',
	chains: [],
	category: null,
	total24h,
	total7d: null,
	total30d: null,
	total1y: null,
	totalAllTime: null,
	mcap: null
})

describe('fetchDimensionDataset', () => {
	beforeEach(() => {
		mocks.fetchAdapterChainMetrics.mockReset()
		mocks.getDimensionAdapterChainEarningsOverview.mockReset()
		mocks.getDimensionChainNameMap.mockReset()
		mocks.getDimensionChainNameMap.mockResolvedValue({
			Ethereum: 'ethereum',
			Base: 'base',
			'X Layer': 'xlayer',
			XRPL: 'ripple',
			Ripple: 'ripple',
			'Robinhood Chain': 'robinhood',
			Vaulta: 'eos',
			EOS: 'eos'
		})
		mocks.metadataCache.chainMetadata = {}
	})

	it('fetches selected non-Earnings chains directly from the canonical v2 metrics route', async () => {
		mocks.metadataCache.chainMetadata = {
			base: { id: 'base', name: 'Base' }
		}
		mocks.fetchAdapterChainMetrics.mockResolvedValue({ protocols: [protocol('Protocol')] })

		const result = await fetchDimensionDataset({
			adapterType: 'dexs',
			route: 'dexs',
			metricName: 'DEX Volume',
			chains: ['Missing', 'Base']
		})

		expect(mocks.fetchAdapterChainMetrics).toHaveBeenCalledOnce()
		expect(mocks.fetchAdapterChainMetrics).toHaveBeenCalledWith({
			adapterType: 'dexs',
			chain: 'Base'
		})
		expect(result).toEqual({
			status: 'partial',
			protocols: [expect.objectContaining({ name: 'Protocol', displayName: 'Protocol', chains: ['Base'] })],
			unavailableChains: ['Missing']
		})
	})

	it('deduplicates selected chains and reports unsupported guarded chains', async () => {
		mocks.metadataCache.chainMetadata = {
			base: { id: 'base', name: 'Base' },
			ethereum: { id: 'ethereum', name: 'Ethereum', fees: true }
		}
		mocks.fetchAdapterChainMetrics.mockResolvedValue({ protocols: [protocol('Protocol')] })

		const result = await fetchDimensionDataset({
			adapterType: 'fees',
			route: 'fees',
			metricName: 'Fees',
			chains: ['Base', 'base', 'Ethereum'],
			chainGuard: 'fees'
		})

		expect(mocks.fetchAdapterChainMetrics).toHaveBeenCalledOnce()
		expect(mocks.fetchAdapterChainMetrics).toHaveBeenCalledWith({ adapterType: 'fees', chain: 'Ethereum' })
		expect(result).toEqual({
			status: 'partial',
			protocols: [expect.objectContaining({ name: 'Protocol', chains: ['Ethereum'] })],
			unavailableChains: ['Base']
		})
	})

	it('shares overlapping selected-chain requests within one dashboard request', async () => {
		mocks.metadataCache.chainMetadata = {
			base: { id: 'base', name: 'Base' },
			ethereum: { id: 'ethereum', name: 'Ethereum' }
		}
		mocks.fetchAdapterChainMetrics.mockResolvedValue({ protocols: [protocol('Protocol')] })
		const requestScope = createDimensionDatasetRequestScope()
		const options = {
			adapterType: 'dexs' as const,
			route: 'dexs',
			metricName: 'DEX Volume'
		}

		await fetchDimensionDataset({ ...options, chains: ['Ethereum', 'Base'] }, requestScope)
		await fetchDimensionDataset({ ...options, chains: ['Ethereum'] }, requestScope)

		expect(mocks.fetchAdapterChainMetrics).toHaveBeenCalledTimes(2)
	})

	it('shares one selected-chain concurrency limit across a dashboard request scope', async () => {
		let startedRequests = 0
		let releaseRequests = () => {}
		const blocked = new Promise<void>((resolve) => {
			releaseRequests = resolve
		})
		const request = async () => {
			startedRequests += 1
			await blocked
		}
		const requestScope = createDimensionDatasetRequestScope()

		const requests = Promise.all(
			Array.from({ length: DIMENSION_DATASET_REQUEST_CONCURRENCY * 3 }, () => requestScope.scheduleRequest(request))
		)
		expect(startedRequests).toBe(DIMENSION_DATASET_REQUEST_CONCURRENCY)

		releaseRequests()
		await requests
	})

	it('shares all-chain requests within one dashboard request', async () => {
		mocks.fetchAdapterChainMetrics.mockResolvedValue({ protocols: [protocol('Protocol')] })
		const requestScope = createDimensionDatasetRequestScope()
		const options = {
			adapterType: 'dexs' as const,
			route: 'dexs',
			metricName: 'DEX Volume'
		}

		await Promise.all([fetchDimensionDataset(options, requestScope), fetchDimensionDataset(options, requestScope)])

		expect(mocks.fetchAdapterChainMetrics).toHaveBeenCalledOnce()
		expect(mocks.fetchAdapterChainMetrics).toHaveBeenCalledWith({ adapterType: 'dexs', chain: 'All' })
	})

	it('shares the canonical daily-revenue request between Revenue and Earnings datasets', async () => {
		const revenueSource = { protocols: [protocol('Protocol')] }
		mocks.fetchAdapterChainMetrics.mockResolvedValue(revenueSource)
		mocks.getDimensionAdapterChainEarningsOverview.mockResolvedValue({
			status: 'available',
			overview: { ...revenueSource, allChains: [], totalDataChart: [] }
		})
		const requestScope = createDimensionDatasetRequestScope()

		await Promise.all([
			fetchDimensionDataset(
				{
					adapterType: 'fees',
					route: 'revenue',
					metricName: 'Revenue',
					dataType: 'dailyRevenue'
				},
				requestScope
			),
			fetchDimensionDataset(
				{
					adapterType: 'fees',
					route: 'earnings',
					metricName: 'Earnings',
					dataType: 'dailyEarnings'
				},
				requestScope
			)
		])

		expect(mocks.fetchAdapterChainMetrics).toHaveBeenCalledOnce()
		expect(mocks.fetchAdapterChainMetrics).toHaveBeenCalledWith({
			adapterType: 'fees',
			chain: 'All',
			dataType: 'dailyRevenue'
		})
	})

	it('builds all-chain Earnings breakdowns from one canonical overview request', async () => {
		mocks.fetchAdapterChainMetrics.mockResolvedValue({ protocols: [protocol('Protocol')] })
		mocks.getDimensionAdapterChainEarningsOverview.mockResolvedValue({
			status: 'available',
			overview: {
				allChains: ['Ethereum', 'Base'],
				protocols: [
					{
						...protocol('Protocol', 270),
						breakdown24h: { ethereum: { Protocol: 100 }, base: { Protocol: 200 } },
						breakdown30d: { ethereum: { Protocol: 1_000 }, base: { Protocol: 2_000 } },
						_emissions: { emission24h: 30, emission30d: 300 }
					}
				],
				totalDataChart: []
			}
		})

		const result = await fetchDimensionDataset({
			adapterType: 'fees',
			route: 'earnings',
			metricName: 'Earnings',
			dataType: 'dailyEarnings',
			withChainBreakdown: true,
			chains: []
		})

		expect(mocks.getDimensionAdapterChainEarningsOverview).toHaveBeenCalledOnce()
		expect(result.protocols[0]?.chainBreakdown).toMatchObject({
			ethereum: { total24h: 90, total7d: null, total30d: 900 },
			base: { total24h: 180, total7d: null, total30d: 1_800 }
		})
	})

	it('preserves unavailable Earnings periods in protocol and chain rows', async () => {
		mocks.fetchAdapterChainMetrics.mockResolvedValue({ protocols: [protocol('Protocol')] })
		mocks.getDimensionAdapterChainEarningsOverview.mockResolvedValue({
			status: 'available',
			overview: {
				allChains: ['Ethereum'],
				protocols: [
					{
						...protocol('Protocol'),
						total24h: null,
						total30d: 100,
						breakdown24h: null,
						breakdown30d: { ethereum: { Protocol: 100 } },
						_emissions: { emission24h: null, emission30d: 0 }
					}
				],
				totalDataChart: []
			}
		})

		const result = await fetchDimensionDataset({
			adapterType: 'fees',
			route: 'earnings',
			metricName: 'Earnings',
			dataType: 'dailyEarnings',
			withChainBreakdown: true,
			chains: []
		})

		expect(result.protocols[0]).toMatchObject({
			total24h: null,
			total30d: 100,
			chainBreakdown: { ethereum: { total24h: null, total30d: 100 } }
		})
	})

	it('builds exact available bridge-aggregator chain periods from one canonical request', async () => {
		mocks.fetchAdapterChainMetrics.mockResolvedValue({
			allChains: ['Ethereum', 'Base', 'X Layer', 'XRPL', 'Robinhood Chain', 'Vaulta'],
			protocols: [
				{
					...protocol('Protocol', 30),
					breakdown24h: {
						ethereum: { Protocol: 10 },
						base: { Protocol: 20 },
						xlayer: { Protocol: 30 },
						ripple: { Protocol: 40 },
						robinhood: { Protocol: 50 },
						eos: { Protocol: 60 }
					},
					breakdown30d: {
						ethereum: { Protocol: 100 },
						base: { Protocol: 200 },
						xlayer: { Protocol: 300 },
						ripple: { Protocol: 400 },
						robinhood: { Protocol: 500 },
						eos: { Protocol: 600 }
					}
				}
			]
		})

		const result = await fetchDimensionDataset({
			adapterType: 'bridge-aggregators',
			route: 'bridge-aggregators',
			metricName: 'Bridge Aggregator Volume',
			withChainBreakdown: true,
			chains: []
		})

		expect(mocks.fetchAdapterChainMetrics).toHaveBeenCalledOnce()
		expect(result.protocols[0]?.chainBreakdown).toMatchObject({
			ethereum: { total24h: 10, total7d: null, total30d: 100, change_1d: null },
			base: { total24h: 20, total7d: null, total30d: 200, change_1d: null },
			'x-layer': { total24h: 30, total30d: 300 },
			xrpl: { total24h: 40, total30d: 400 },
			'robinhood-chain': { total24h: 50, total30d: 500 },
			vaulta: { total24h: 60, total30d: 600 }
		})
	})

	it('keeps an unavailable batched chain period null when another period identifies the chain', async () => {
		mocks.fetchAdapterChainMetrics.mockResolvedValue({
			allChains: ['Ethereum'],
			protocols: [
				{
					...protocol('Protocol'),
					total24h: null,
					total30d: 100,
					breakdown24h: null,
					breakdown30d: { ethereum: { Protocol: 100 } }
				}
			]
		})

		const result = await fetchDimensionDataset({
			adapterType: 'bridge-aggregators',
			route: 'bridge-aggregators',
			metricName: 'Bridge Aggregator Volume',
			withChainBreakdown: true,
			chains: []
		})

		expect(result.protocols[0]?.chainBreakdown?.ethereum).toMatchObject({ total24h: null, total30d: 100 })
	})

	it('keeps successful chains and their nullable periods after a partial failure', async () => {
		const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined)
		mocks.metadataCache.chainMetadata = {
			base: { id: 'base', name: 'Base' },
			ethereum: { id: 'ethereum', name: 'Ethereum' }
		}
		mocks.fetchAdapterChainMetrics.mockImplementation(async ({ chain }: { chain: string }) => {
			if (chain === 'Base') throw new Error('base unavailable')
			return { protocols: [protocol('Protocol')] }
		})

		const result = await fetchDimensionDataset({
			adapterType: 'aggregators',
			route: 'dex-aggregators',
			metricName: 'DEX Aggregator Volume',
			chains: ['Base', 'Ethereum'],
			withChainBreakdown: true
		})

		expect(result.status).toBe('partial')
		if (result.status !== 'partial') return
		expect(result.unavailableChains).toEqual(['Base'])
		expect(result.protocols).toHaveLength(1)
		const chainBreakdown = result.protocols[0]?.chainBreakdown
		expect(chainBreakdown).toBeDefined()
		expect(chainBreakdown?.ethereum).toEqual(
			expect.objectContaining({ chain: 'Ethereum', total24h: 10, total7d: null, total30d: null, change_7d: null })
		)
		expect(consoleInfo).toHaveBeenCalledWith('Chain metrics data not found aggregators : chain:Base', expect.any(Error))
		consoleInfo.mockRestore()
	})

	it('projects selected-chain Earnings from one global overview', async () => {
		mocks.metadataCache.chainMetadata = {
			base: { id: 'base', name: 'Base', fees: true }
		}
		mocks.fetchAdapterChainMetrics.mockResolvedValue({ protocols: [protocol('Protocol')] })
		mocks.getDimensionAdapterChainEarningsOverview.mockResolvedValue({
			status: 'available',
			overview: {
				allChains: ['Base'],
				protocols: [
					{
						...protocol('Protocol', -5),
						total30d: -50,
						breakdown24h: { base: { Protocol: 10 } },
						breakdown30d: { base: { Protocol: 100 } },
						_emissions: { emission24h: 15, emission30d: 150 }
					}
				],
				totalDataChart: []
			}
		})

		const result = await fetchDimensionDataset({
			adapterType: 'fees',
			route: 'earnings',
			metricName: 'Earnings',
			dataType: 'dailyEarnings',
			chains: ['Base'],
			chainGuard: 'fees'
		})

		expect(mocks.getDimensionAdapterChainEarningsOverview).toHaveBeenCalledOnce()
		expect(mocks.getDimensionAdapterChainEarningsOverview).toHaveBeenCalledWith({
			chain: 'All',
			overviewData: { protocols: [protocol('Protocol')] },
			totalDataChart: []
		})
		expect(mocks.fetchAdapterChainMetrics).toHaveBeenCalledWith({
			adapterType: 'fees',
			chain: 'All',
			dataType: 'dailyRevenue'
		})
		expect(result.protocols[0]?.total24h).toBe(-5)
		expect(result.protocols[0]).toMatchObject({ total7d: null, total30d: -50, total1y: null, change_1d: null })
	})

	it('reports a selected Earnings chain missing from the authoritative map as unavailable', async () => {
		mocks.metadataCache.chainMetadata = {
			base: { id: 'base', name: 'Base', fees: true },
			ethereum: { id: 'ethereum', name: 'Ethereum', fees: true }
		}
		mocks.getDimensionChainNameMap.mockResolvedValue({ Ethereum: 'ethereum' })
		mocks.fetchAdapterChainMetrics.mockResolvedValue({ protocols: [protocol('Protocol')] })
		mocks.getDimensionAdapterChainEarningsOverview.mockResolvedValue({
			status: 'available',
			overview: {
				allChains: ['Ethereum'],
				protocols: [
					{
						...protocol('Protocol', -5),
						breakdown24h: { ethereum: { Protocol: 10 } },
						breakdown30d: { ethereum: { Protocol: 100 } },
						_emissions: { emission24h: 15, emission30d: 150 }
					}
				],
				totalDataChart: []
			}
		})

		const result = await fetchDimensionDataset({
			adapterType: 'fees',
			route: 'earnings',
			metricName: 'Earnings',
			dataType: 'dailyEarnings',
			chains: ['Base', 'Ethereum'],
			chainGuard: 'fees'
		})

		expect(result).toMatchObject({
			status: 'partial',
			unavailableChains: ['Base'],
			protocols: [{ total24h: -5, total7d: null, total30d: -50 }]
		})
	})

	it('aggregates selected Earnings chains from one global source while preserving unavailable periods', async () => {
		mocks.metadataCache.chainMetadata = {
			base: { id: 'base', name: 'Base', fees: true },
			ethereum: { id: 'ethereum', name: 'Ethereum', fees: true }
		}
		mocks.fetchAdapterChainMetrics.mockResolvedValue({ protocols: [protocol('Protocol')] })
		mocks.getDimensionAdapterChainEarningsOverview.mockResolvedValue({
			status: 'available',
			overview: {
				allChains: ['Base', 'Ethereum'],
				protocols: [
					{
						...protocol('Protocol', -12),
						total30d: -120,
						breakdown24h: { base: { Protocol: 10 }, ethereum: { Protocol: 20 } },
						breakdown30d: { base: { Protocol: 100 }, ethereum: { Protocol: 200 } },
						_emissions: { emission24h: 42, emission30d: 420 }
					}
				],
				totalDataChart: []
			}
		})

		const result = await fetchDimensionDataset({
			adapterType: 'fees',
			route: 'earnings',
			metricName: 'Earnings',
			dataType: 'dailyEarnings',
			chains: ['Base', 'Ethereum'],
			chainGuard: 'fees'
		})

		expect(result).toMatchObject({
			status: 'complete',
			protocols: [{ total24h: -12, total7d: null, total30d: -120, total1y: null, totalAllTime: null }]
		})
		expect(mocks.getDimensionAdapterChainEarningsOverview).toHaveBeenCalledOnce()
	})

	it('propagates a global Earnings source failure', async () => {
		mocks.fetchAdapterChainMetrics.mockResolvedValue({ protocols: [protocol('Protocol')] })
		mocks.getDimensionAdapterChainEarningsOverview.mockRejectedValue(new Error('emissions unavailable'))

		await expect(
			fetchDimensionDataset({
				adapterType: 'fees',
				route: 'earnings',
				metricName: 'Earnings',
				dataType: 'dailyEarnings'
			})
		).rejects.toThrow('emissions unavailable')
	})

	it('preserves nullable leaf periods while summing available selected-chain activity', async () => {
		mocks.metadataCache.chainMetadata = {
			base: { id: 'base', name: 'Base' },
			ethereum: { id: 'ethereum', name: 'Ethereum' }
		}
		mocks.fetchAdapterChainMetrics.mockImplementation(async ({ chain }: { chain: string }) => ({
			protocols: [
				{
					...protocol('Protocol'),
					total24h: chain === 'Base' ? null : 10,
					total48hto24h: chain === 'Base' ? 5 : null
				}
			]
		}))

		const result = await fetchDimensionDataset({
			adapterType: 'dexs',
			route: 'dexs',
			metricName: 'DEX Volume',
			chains: ['Base', 'Ethereum'],
			withChainBreakdown: true
		})

		expect(result).toMatchObject({
			status: 'complete',
			protocols: [
				{
					total24h: 10,
					total48hto24h: 5,
					change_1d: 100,
					chainBreakdown: {
						base: { total24h: null, total48hto24h: 5, change_1d: null },
						ethereum: { total24h: 10, total48hto24h: null, change_1d: null }
					}
				}
			]
		})
	})

	it('returns undefined for an unknown dataset spec without widening the discriminated registry', () => {
		expect(getDimensionDatasetSpec('perps')?.options.adapterType).toBe('derivatives')
		expect(getDimensionDatasetSpec('not-a-dataset')).toBeUndefined()
	})
})
