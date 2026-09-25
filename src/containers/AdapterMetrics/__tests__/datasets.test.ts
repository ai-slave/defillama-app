import { beforeEach, describe, expect, test, vi } from 'vitest'
import { installMetadataSeeder } from '~/utils/test/metadataCache'

// Dimensions chain names -> internal chain keys. The server module caches this map for the process, so it stays fixed.
const CHAIN_NAME_MAP = {
	Ethereum: 'ethereum',
	Base: 'base',
	'X Layer': 'xlayer',
	XRPL: 'ripple',
	Ripple: 'ripple',
	'Robinhood Chain': 'robinhood',
	Vaulta: 'eos',
	EOS: 'eos'
}

const upstream = vi.hoisted(() => ({
	metrics: (() => undefined) as (chain: string, dataType: string | null) => unknown,
	emissions: [] as Array<unknown> | null,
	metricRequests: [] as Array<string>
}))

vi.mock('~/utils/async', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/async')>()),
	fetchJson: async (url: string) => {
		const { pathname, search } = new URL(url)
		if (pathname.endsWith('/overview/_internal/chain-name-id-map')) return CHAIN_NAME_MAP
		if (pathname.endsWith('/emissionsBreakdownAggregated')) {
			if (upstream.emissions === null) throw new Error('emissions unavailable')
			return { protocols: upstream.emissions }
		}
		const metrics = pathname.match(/(\/metrics\/[^/]+)(?:\/chain\/([^/]+))?$/)
		if (!metrics) throw new Error(`Unrouted upstream request: ${url}`)
		upstream.metricRequests.push(metrics[0] + search)
		const body = await upstream.metrics(metrics[2] ?? 'all', new URLSearchParams(search).get('dataType'))
		if (body === undefined) throw new Error(`Unrouted metrics request: ${url}`)
		return body
	}
}))

import {
	createDimensionDatasetRequestScope,
	DIMENSION_DATASET_REQUEST_CONCURRENCY,
	fetchDimensionDataset,
	getDimensionDatasetSpec
} from '../server/datasets'

const metadata = installMetadataSeeder()

const protocol = (name: string, total24h: number | null = 10) => ({
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

const emission = (defillamaId: string, emission24h: number | null, emission30d: number) => ({
	name: defillamaId,
	defillamaId,
	linked: [],
	category: '',
	chain: '',
	emission24h,
	emission7d: 0,
	emission30d,
	emissions1y: 0,
	emissionsAllTime: 0,
	emissionsAverage1y: 0,
	emissionsMonthlyAverage1y: null
})

const earningsChainMetadata = {
	base: { id: 'base', name: 'Base', fees: true },
	ethereum: { id: 'ethereum', name: 'Ethereum', fees: true },
	sui: { id: 'sui', name: 'Sui', fees: true }
}

const earningsOptions = {
	adapterType: 'fees',
	route: 'earnings',
	metricName: 'Earnings',
	dataType: 'dailyEarnings'
} as const

describe('fetchDimensionDataset', () => {
	beforeEach(() => {
		upstream.metrics = () => undefined
		upstream.emissions = []
		upstream.metricRequests = []
		metadata.seed({ chainMetadata: {} })
	})

	test('fetches selected non-Earnings chains directly from the canonical v2 metrics route', async () => {
		metadata.seed({ chainMetadata: { base: { id: 'base', name: 'Base' } } })
		upstream.metrics = () => ({ protocols: [protocol('Protocol')] })

		const result = await fetchDimensionDataset({
			adapterType: 'dexs',
			route: 'dexs',
			metricName: 'DEX Volume',
			chains: ['Missing', 'Base']
		})

		expect(upstream.metricRequests).toEqual(['/metrics/dexs/chain/base'])
		expect(result).toEqual({
			status: 'partial',
			protocols: [expect.objectContaining({ name: 'Protocol', displayName: 'Protocol', chains: ['Base'] })],
			unavailableChains: ['Missing']
		})
	})

	test('deduplicates selected chains and reports unsupported guarded chains', async () => {
		metadata.seed({
			chainMetadata: { base: { id: 'base', name: 'Base' }, ethereum: { id: 'ethereum', name: 'Ethereum', fees: true } }
		})
		upstream.metrics = () => ({ protocols: [protocol('Protocol')] })

		const result = await fetchDimensionDataset({
			adapterType: 'fees',
			route: 'fees',
			metricName: 'Fees',
			chains: ['Base', 'base', 'Ethereum'],
			chainGuard: 'fees'
		})

		expect(upstream.metricRequests).toEqual(['/metrics/fees/chain/ethereum'])
		expect(result).toEqual({
			status: 'partial',
			protocols: [expect.objectContaining({ name: 'Protocol', chains: ['Ethereum'] })],
			unavailableChains: ['Base']
		})
	})

	test('shares overlapping selected-chain requests within one dashboard request', async () => {
		metadata.seed({
			chainMetadata: { base: { id: 'base', name: 'Base' }, ethereum: { id: 'ethereum', name: 'Ethereum' } }
		})
		upstream.metrics = () => ({ protocols: [protocol('Protocol')] })
		const requestScope = createDimensionDatasetRequestScope()
		const options = { adapterType: 'dexs' as const, route: 'dexs', metricName: 'DEX Volume' }

		await fetchDimensionDataset({ ...options, chains: ['Ethereum', 'Base'] }, requestScope)
		await fetchDimensionDataset({ ...options, chains: ['Ethereum'] }, requestScope)

		expect(upstream.metricRequests.sort()).toEqual(['/metrics/dexs/chain/base', '/metrics/dexs/chain/ethereum'])
	})

	test('shares one selected-chain concurrency limit across a dashboard request scope', async () => {
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

	test('shares all-chain requests within one dashboard request', async () => {
		upstream.metrics = () => ({ protocols: [protocol('Protocol')] })
		const requestScope = createDimensionDatasetRequestScope()
		const options = { adapterType: 'dexs' as const, route: 'dexs', metricName: 'DEX Volume' }

		await Promise.all([fetchDimensionDataset(options, requestScope), fetchDimensionDataset(options, requestScope)])

		expect(upstream.metricRequests).toEqual(['/metrics/dexs'])
	})

	test('shares the canonical daily-revenue request between Revenue and Earnings datasets', async () => {
		upstream.metrics = () => ({ protocols: [protocol('Protocol')] })
		const requestScope = createDimensionDatasetRequestScope()

		await Promise.all([
			fetchDimensionDataset(
				{ adapterType: 'fees', route: 'revenue', metricName: 'Revenue', dataType: 'dailyRevenue' },
				requestScope
			),
			fetchDimensionDataset(earningsOptions, requestScope)
		])

		expect(upstream.metricRequests).toEqual(['/metrics/fees?dataType=dailyRevenue'])
	})

	test('builds all-chain Earnings breakdowns by subtracting chain-weighted emissions from revenue', async () => {
		upstream.metrics = () => ({
			allChains: ['Ethereum', 'Base'],
			protocols: [
				{
					...protocol('Protocol', 300),
					total30d: 3000,
					breakdown24h: { ethereum: { Protocol: 100 }, base: { Protocol: 200 } },
					breakdown30d: { ethereum: { Protocol: 1000 }, base: { Protocol: 2000 } }
				}
			]
		})
		upstream.emissions = [emission('protocol', 30, 300)]

		const result = await fetchDimensionDataset({ ...earningsOptions, withChainBreakdown: true, chains: [] })

		expect(result.protocols[0]).toMatchObject({ total24h: 270, total30d: 2700 })
		expect(result.protocols[0]?.chainBreakdown).toMatchObject({
			ethereum: { total24h: 90, total7d: null, total30d: 900 },
			base: { total24h: 180, total7d: null, total30d: 1800 }
		})
	})

	test('preserves unavailable Earnings periods in protocol and chain rows', async () => {
		upstream.metrics = () => ({
			allChains: ['Ethereum'],
			protocols: [
				{
					...protocol('Protocol', null),
					total30d: 100,
					breakdown24h: null,
					breakdown30d: { ethereum: { Protocol: 100 } }
				}
			]
		})
		upstream.emissions = [emission('protocol', null, 0)]

		const result = await fetchDimensionDataset({ ...earningsOptions, withChainBreakdown: true, chains: [] })

		expect(result.protocols[0]).toMatchObject({
			total24h: null,
			total30d: 100,
			chainBreakdown: { ethereum: { total24h: null, total30d: 100 } }
		})
	})

	test('builds exact available bridge-aggregator chain periods from one canonical request', async () => {
		upstream.metrics = () => ({
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

		expect(upstream.metricRequests).toEqual(['/metrics/bridge-aggregators'])
		expect(result.protocols[0]?.chainBreakdown).toMatchObject({
			ethereum: { total24h: 10, total7d: null, total30d: 100, change_1d: null },
			base: { total24h: 20, total7d: null, total30d: 200, change_1d: null },
			'x-layer': { total24h: 30, total30d: 300 },
			xrpl: { total24h: 40, total30d: 400 },
			'robinhood-chain': { total24h: 50, total30d: 500 },
			vaulta: { total24h: 60, total30d: 600 }
		})
	})

	test('keeps an unavailable batched chain period null when another period identifies the chain', async () => {
		upstream.metrics = () => ({
			allChains: ['Ethereum'],
			protocols: [
				{
					...protocol('Protocol', null),
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

	test('keeps successful chains and their nullable periods after a partial failure', async () => {
		const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined)
		metadata.seed({
			chainMetadata: { base: { id: 'base', name: 'Base' }, ethereum: { id: 'ethereum', name: 'Ethereum' } }
		})
		upstream.metrics = (chain) => {
			if (chain === 'base') throw new Error('base unavailable')
			return { protocols: [protocol('Protocol')] }
		}

		const result = await fetchDimensionDataset({
			adapterType: 'aggregators',
			route: 'dex-aggregators',
			metricName: 'DEX Aggregator Volume',
			chains: ['Base', 'Ethereum'],
			withChainBreakdown: true
		})

		expect(result).toMatchObject({ status: 'partial', unavailableChains: ['Base'] })
		expect(result.protocols).toHaveLength(1)
		expect(result.protocols[0]?.chainBreakdown?.ethereum).toEqual(
			expect.objectContaining({ chain: 'Ethereum', total24h: 10, total7d: null, total30d: null, change_7d: null })
		)
		consoleInfo.mockRestore()
	})

	test('projects selected-chain Earnings from one global daily-revenue overview', async () => {
		metadata.seed({ chainMetadata: earningsChainMetadata })
		upstream.metrics = () => ({
			allChains: ['Base'],
			protocols: [
				{
					...protocol('Protocol', 10),
					total30d: 100,
					breakdown24h: { base: { Protocol: 10 } },
					breakdown30d: { base: { Protocol: 100 } }
				}
			]
		})
		upstream.emissions = [emission('protocol', 15, 150)]

		const result = await fetchDimensionDataset({ ...earningsOptions, chains: ['Base'], chainGuard: 'fees' })

		expect(upstream.metricRequests).toEqual(['/metrics/fees?dataType=dailyRevenue'])
		expect(result.protocols[0]).toMatchObject({
			total24h: -5,
			total7d: null,
			total30d: -50,
			total1y: null,
			change_1d: null
		})
	})

	test('reports a selected Earnings chain missing from the Dimensions chain-name map as unavailable', async () => {
		metadata.seed({ chainMetadata: earningsChainMetadata })
		upstream.metrics = () => ({
			allChains: ['Ethereum'],
			protocols: [
				{
					...protocol('Protocol', 10),
					total30d: 100,
					breakdown24h: { ethereum: { Protocol: 10 } },
					breakdown30d: { ethereum: { Protocol: 100 } }
				}
			]
		})
		upstream.emissions = [emission('protocol', 15, 150)]

		const result = await fetchDimensionDataset({ ...earningsOptions, chains: ['Sui', 'Ethereum'], chainGuard: 'fees' })

		expect(result).toMatchObject({
			status: 'partial',
			unavailableChains: ['Sui'],
			protocols: [{ total24h: -5, total7d: null, total30d: -50 }]
		})
	})

	test('aggregates selected Earnings chains from one global source while preserving unavailable periods', async () => {
		metadata.seed({ chainMetadata: earningsChainMetadata })
		upstream.metrics = () => ({
			allChains: ['Base', 'Ethereum'],
			protocols: [
				{
					...protocol('Protocol', 30),
					total30d: 300,
					breakdown24h: { base: { Protocol: 10 }, ethereum: { Protocol: 20 } },
					breakdown30d: { base: { Protocol: 100 }, ethereum: { Protocol: 200 } }
				}
			]
		})
		upstream.emissions = [emission('protocol', 42, 420)]

		const result = await fetchDimensionDataset({ ...earningsOptions, chains: ['Base', 'Ethereum'], chainGuard: 'fees' })

		expect(result).toMatchObject({
			status: 'complete',
			protocols: [{ total24h: -12, total7d: null, total30d: -120, total1y: null, totalAllTime: null }]
		})
	})

	test('rejects all-chain Earnings when emissions data cannot be loaded', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
		upstream.metrics = () => ({ protocols: [protocol('Protocol')] })
		upstream.emissions = null

		await expect(fetchDimensionDataset(earningsOptions)).rejects.toThrow(
			'Earnings are unavailable because emissions data could not be loaded'
		)
		consoleError.mockRestore()
	})

	test('preserves nullable leaf periods while summing available selected-chain activity', async () => {
		metadata.seed({
			chainMetadata: { base: { id: 'base', name: 'Base' }, ethereum: { id: 'ethereum', name: 'Ethereum' } }
		})
		upstream.metrics = (chain) => ({
			protocols: [
				{
					...protocol('Protocol'),
					total24h: chain === 'base' ? null : 10,
					total48hto24h: chain === 'base' ? 5 : null
				}
			]
		})

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

	test('fetches the perps dataset from the derivatives metrics route', async () => {
		upstream.metrics = () => ({ protocols: [protocol('Perp')] })

		const result = await fetchDimensionDataset(getDimensionDatasetSpec('perps')!.options)

		expect(upstream.metricRequests).toEqual(['/metrics/derivatives'])
		expect(result.protocols.map(({ name }) => name)).toEqual(['Perp'])
	})
})
