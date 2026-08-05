import { describe, expect, it } from 'vitest'
import type { ChainChartResponse } from '~/containers/Chains/api.types'
import type { IRWAStatsResponse } from '~/containers/RWA/api.types'
import type { ICategoriesAndTags, IChainMetadata } from '~/utils/metadata/types'
import { createRoutePhaseTimer } from '~/utils/perf'
import {
	getChainOverviewData,
	getChainOverviewTvlOptions,
	getChainRev24h,
	getDexDominance,
	getRwaActiveMcapForChain,
	hasRwaActiveMcapChain,
	shouldShowChainOverviewBridgedTvlChart,
	shouldFetchChainDexs,
	shouldFetchChainPerps,
	sumAdapterProtocol24h
} from '../queries.server'

const categoriesAndTagsMetadata = {
	categories: ['Dexs', 'Derivatives', 'OTC Marketplace'],
	tags: [],
	tagCategoryMap: {},
	configs: {
		Dexs: {
			category: 'Dexs',
			chains: ['ethereum'],
			slug: 'dexs',
			dexs: true
		},
		'OTC Marketplace': {
			category: 'OTC Marketplace',
			chains: ['provenance'],
			slug: 'otc-marketplace',
			dexs: true
		},
		Derivatives: {
			category: 'Derivatives',
			chains: ['ethereum'],
			slug: 'derivatives',
			perps: true
		}
	}
} satisfies ICategoriesAndTags

describe('shouldFetchChainDexs', () => {
	it('accepts an optional phase timer without changing missing-chain results', async () => {
		const phaseTimer = createRoutePhaseTimer()

		await expect(
			getChainOverviewData({
				chain: 'missing',
				chainMetadata: {},
				protocolMetadata: {},
				categoriesAndTagsMetadata,
				phaseTimer
			})
		).resolves.toBeNull()
		expect(phaseTimer.timings()).toEqual({})
	})

	it('skips dexs when the chain has the metadata flag but is not in the default Dexs category', () => {
		const provenance = {
			name: 'Provenance',
			id: 'provenance',
			dexs: true
		} satisfies IChainMetadata

		expect(
			shouldFetchChainDexs({
				chain: 'provenance',
				currentChainMetadata: provenance,
				categoriesAndTagsMetadata
			})
		).toBe(false)
	})

	it('fetches dexs when the chain id is in the default Dexs category', () => {
		const ethereum = {
			name: 'Ethereum',
			id: 'ethereum',
			dexs: true
		} satisfies IChainMetadata

		expect(
			shouldFetchChainDexs({
				chain: 'ethereum',
				currentChainMetadata: ethereum,
				categoriesAndTagsMetadata
			})
		).toBe(true)
	})

	it('keeps All chains dexs enabled', () => {
		const allChains = {
			name: 'All',
			id: 'all',
			dexs: true
		} satisfies IChainMetadata

		expect(
			shouldFetchChainDexs({
				chain: 'All',
				currentChainMetadata: allChains,
				categoriesAndTagsMetadata
			})
		).toBe(true)
	})
})

describe('shouldFetchChainPerps', () => {
	it('skips perps when the chain has the metadata flag but is not in the Derivatives category', () => {
		const xdc = {
			name: 'XDC',
			id: 'xdc',
			perps: true
		} satisfies IChainMetadata

		expect(
			shouldFetchChainPerps({
				chain: 'xdc',
				currentChainMetadata: xdc,
				categoriesAndTagsMetadata
			})
		).toBe(false)
	})

	it('fetches perps when the chain id is in the Derivatives category', () => {
		const ethereum = {
			name: 'Ethereum',
			id: 'ethereum',
			perps: true
		} satisfies IChainMetadata

		expect(
			shouldFetchChainPerps({
				chain: 'ethereum',
				currentChainMetadata: ethereum,
				categoriesAndTagsMetadata
			})
		).toBe(true)
	})

	it('keeps All chains perps enabled', () => {
		const allChains = {
			name: 'All',
			id: 'all',
			perps: true
		} satisfies IChainMetadata

		expect(
			shouldFetchChainPerps({
				chain: 'All',
				currentChainMetadata: allChains,
				categoriesAndTagsMetadata
			})
		).toBe(true)
	})
})

describe('getChainOverviewTvlOptions', () => {
	const makeChartData = (staking: ChainChartResponse['staking']): ChainChartResponse => ({
		tvl: [],
		...(staking !== undefined ? { staking } : {}),
		borrowed: [],
		pool2: [],
		vesting: [],
		offers: [],
		doublecounted: [],
		liquidstaking: [],
		dcAndLsOverlap: []
	})

	it('derives filter options only from available TVL series', () => {
		const options = getChainOverviewTvlOptions(makeChartData([['1', 1]]))

		expect(options.map((option) => option.key)).toEqual(['staking'])
		expect(getChainOverviewTvlOptions(makeChartData([]))).toEqual([])
	})
})

describe('shouldShowChainOverviewBridgedTvlChart', () => {
	const chainAssetsMetadata = { chainAssets: true }

	it('shows the historical chart for non-All chain pages with chainAssets metadata', () => {
		expect(shouldShowChainOverviewBridgedTvlChart({ chain: 'Base', currentChainMetadata: chainAssetsMetadata })).toBe(
			true
		)
	})

	it('does not show the historical chart for All chains or missing chainAssets metadata', () => {
		expect(shouldShowChainOverviewBridgedTvlChart({ chain: 'All', currentChainMetadata: chainAssetsMetadata })).toBe(
			false
		)
		expect(shouldShowChainOverviewBridgedTvlChart({ chain: 'Base', currentChainMetadata: {} })).toBe(false)
	})
})

describe('getRwaActiveMcapForChain', () => {
	const stats = {
		totalOnChainMcap: 120,
		totalActiveMcap: 90,
		totalDefiActiveTvl: 10,
		assetCount: 1,
		assetIssuers: 1,
		byChain: {
			'XDC Network': {
				base: { onChainMcap: 120, activeMcap: 90, defiActiveTvl: 10, assetCount: 1, assetIssuers: ['Issuer A'] },
				stablecoinsOnly: { onChainMcap: 0, activeMcap: 0, defiActiveTvl: 0, assetCount: 0, assetIssuers: [] },
				governanceOnly: { onChainMcap: 0, activeMcap: 0, defiActiveTvl: 0, assetCount: 0, assetIssuers: [] },
				stablecoinsAndGovernance: { onChainMcap: 0, activeMcap: 0, defiActiveTvl: 0, assetCount: 0, assetIssuers: [] }
			},
			EmptyChain: {
				base: { onChainMcap: 0, activeMcap: 0, defiActiveTvl: 0, assetCount: 0, assetIssuers: [] },
				stablecoinsOnly: { onChainMcap: 0, activeMcap: 0, defiActiveTvl: 0, assetCount: 0, assetIssuers: [] },
				governanceOnly: { onChainMcap: 0, activeMcap: 0, defiActiveTvl: 0, assetCount: 0, assetIssuers: [] },
				stablecoinsAndGovernance: { onChainMcap: 0, activeMcap: 0, defiActiveTvl: 0, assetCount: 0, assetIssuers: [] }
			}
		},
		byCategory: {},
		byPlatform: {},
		byAssetGroup: {}
	} satisfies IRWAStatsResponse

	it('resolves active market cap by RWA chain slug', () => {
		expect(getRwaActiveMcapForChain(stats, 'XDC-Network')).toBe(90)
	})

	it('preserves zero and returns null only for missing active market cap', () => {
		expect(getRwaActiveMcapForChain(stats, 'EmptyChain')).toBe(0)
		expect(getRwaActiveMcapForChain(stats, 'Missing')).toBeNull()
	})
})

describe('chain overview nullable aggregates', () => {
	it('treats missing periods in a successful fee response as zero activity', () => {
		expect(sumAdapterProtocol24h([{ total24h: 0 }, { total24h: 5 }])).toBe(5)
		expect(sumAdapterProtocol24h([{ total24h: null }, { total24h: 5 }])).toBe(5)
		expect(sumAdapterProtocol24h([])).toBe(0)
		expect(sumAdapterProtocol24h(null)).toBeNull()
	})

	it('adds configured REV contributions while preserving unavailable responses', () => {
		const revProtocolSlugs = new Set(['mev-tips'])
		expect(
			getChainRev24h({
				chainFees24h: 10,
				feeProtocols: [{ slug: 'mev-tips', total24h: 2 }],
				revProtocolSlugs
			})
		).toBe(12)
		expect(getChainRev24h({ chainFees24h: null, feeProtocols: [], revProtocolSlugs })).toBeNull()
		expect(getChainRev24h({ chainFees24h: 10, feeProtocols: [], revProtocolSlugs })).toBe(10)
		expect(
			getChainRev24h({
				chainFees24h: 10,
				feeProtocols: [{ slug: 'mev-tips', total24h: null }],
				revProtocolSlugs
			})
		).toBe(10)
		expect(getChainRev24h({ chainFees24h: 10, feeProtocols: null, revProtocolSlugs })).toBeNull()
		expect(getChainRev24h({ chainFees24h: 10, feeProtocols: null, revProtocolSlugs: [] })).toBe(10)
	})

	it('preserves a valid zero DEX share when the denominator is known', () => {
		expect(getDexDominance(100, 0)).toBe(0)
		expect(getDexDominance(0, 100)).toBe(100)
		expect(getDexDominance(0, 0)).toBeNull()
		expect(getDexDominance(null, 100)).toBeNull()
	})
})

describe('hasRwaActiveMcapChain', () => {
	it('matches covered RWA chains by slug', () => {
		expect(hasRwaActiveMcapChain(['XDC Network'], 'xdc-network')).toBe(true)
	})

	it('skips missing RWA chains', () => {
		expect(hasRwaActiveMcapChain(['Ethereum'], 'Solana')).toBe(false)
		expect(hasRwaActiveMcapChain(null, 'Ethereum')).toBe(false)
	})
})
