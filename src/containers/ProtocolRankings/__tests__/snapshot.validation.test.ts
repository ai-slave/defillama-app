import { beforeEach, describe, expect, test, vi } from 'vitest'
import { installTelemetrySink } from '~/utils/testing/telemetry'

const cacheMocks = vi.hoisted(() => ({
	getCache: vi.fn(),
	setCache: vi.fn(),
	getObjectCache: vi.fn(),
	setObjectCache: vi.fn()
}))
const telemetry = installTelemetrySink()

vi.mock('~/utils/cache-client', () => cacheMocks)

import type { IChainMetadata } from '~/utils/metadata/types'
import { getProtocolRankingsSnapshot, type ProtocolRankingsCanonicalSnapshot } from '../server/tableData.server'
import { assertPublishableSnapshot, ProtocolRankingSnapshotValidationError } from '../snapshot.validation'
import type { IProtocol } from '../types'

function protocol(id: string, tvl: number | null): IProtocol {
	return {
		id,
		name: id,
		slug: id,
		chains: ['Ethereum'],
		category: null,
		tvl: { default: { tvl, tvlPrevDay: tvl, tvlPrevWeek: tvl, tvlPrevMonth: tvl } },
		tvlChange: { change1d: 0, change7d: 0, change1m: 0 },
		mcap: null,
		tokenPrice: null,
		mcaptvl: null,
		strikeTvl: false
	} as IProtocol
}

function snapshot(overrides: Partial<ProtocolRankingsCanonicalSnapshot> = {}): ProtocolRankingsCanonicalSnapshot {
	return {
		chain: 'Ethereum',
		createdAt: 1,
		snapshot: 'aK3f9Qm2xLpR7Bn0Wc-T',
		protocols: [protocol('aave', 100)],
		availableActivityMetrics: [],
		source: {
			chains: ['Ethereum'],
			feeProtocols: null,
			dexs: { total24h: 1, total7d: 7, change_7dover7d: 0, recentChart: [] },
			perps: { total24h: 1 }
		},
		...overrides
	}
}

const healthyContext = { expectProtocols: true, expectDexs: true, expectPerps: true, previousProtocolCount: null }

describe('assertPublishableSnapshot', () => {
	test('rejects an empty protocols list', () => {
		expect(() => assertPublishableSnapshot(snapshot({ protocols: [] }), healthyContext)).toThrow(
			ProtocolRankingSnapshotValidationError
		)
		expect(() =>
			assertPublishableSnapshot(snapshot({ protocols: [] }), { ...healthyContext, expectProtocols: false })
		).not.toThrow()
	})

	test('rejects a row count that dropped below the ratio floor of the previous snapshot', () => {
		const rows = Array.from({ length: 6 }, (_, index) => protocol(`p${index}`, 10))
		expect(() =>
			assertPublishableSnapshot(snapshot({ protocols: rows }), { ...healthyContext, previousProtocolCount: 10 })
		).toThrow(/dropped/)
		expect(() =>
			assertPublishableSnapshot(snapshot({ protocols: rows }), { ...healthyContext, previousProtocolCount: 8 })
		).not.toThrow()
	})

	test('rejects missing expected sources — the silent-adapter-failure case', () => {
		const noDexs = snapshot({ source: { ...snapshot().source, dexs: null } })
		expect(() => assertPublishableSnapshot(noDexs, healthyContext)).toThrow(/DEX/)
		expect(() => assertPublishableSnapshot(noDexs, { ...healthyContext, expectDexs: false })).not.toThrow()

		const noPerps = snapshot({ source: { ...snapshot().source, perps: null } })
		expect(() => assertPublishableSnapshot(noPerps, healthyContext)).toThrow(/perps/)

		const noChains = snapshot({ source: { ...snapshot().source, chains: [] } })
		expect(() => assertPublishableSnapshot(noChains, healthyContext)).toThrow(/chain list/)
	})
})

describe('getProtocolRankingsSnapshot publication gate', () => {
	const published = new Map<string, unknown>()
	// cachedResult state is per-namespace-global; each test uses its own chain
	// so a snapshot cached by one test cannot serve the next.
	const chainMetadata: Record<string, IChainMetadata> = {
		ethereum: { id: '1', name: 'Ethereum', dexs: true, perps: true } as IChainMetadata,
		polygon: { id: '137', name: 'Polygon', dexs: true, perps: true } as IChainMetadata,
		base: { id: '8453', name: 'Base', dexs: true, perps: true } as IChainMetadata,
		tron: { id: '728', name: 'Tron', dexs: true, perps: true } as IChainMetadata
	}
	const args = {
		chainMetadata,
		protocolMetadata: {
			aave: { name: 'aave', displayName: 'aave', tvl: true, category: 'Lending', chains: ['Ethereum'] }
		},
		categoriesAndTagsMetadata: {
			configs: { Dexs: { chains: ['1', '137'] }, Derivatives: { chains: ['1', '137'] } }
		} as never
	}

	beforeEach(() => {
		vi.resetAllMocks()
		published.clear()
		cacheMocks.setCache.mockImplementation(async (payload: { Key: string; Body: Buffer }) => {
			published.set(payload.Key, payload.Body)
			return true
		})
		cacheMocks.setObjectCache.mockImplementation(async (key: string, body: unknown) => {
			published.set(key, body)
			return true
		})
		telemetry.serve({
			'https://api.llama.fi/v2/metrics/dexs/': { protocols: [], total24h: 1, total7d: 7, change_7dover7d: 0 },
			'https://api.llama.fi/v2/chart/dexs/': [],
			'https://api.llama.fi/v2/metrics/derivatives/': { protocols: [], total24h: 1 }
		})
		cacheMocks.getObjectCache.mockResolvedValue(null)
		cacheMocks.getCache.mockResolvedValue(null)
	})

	test('publishes a healthy rebuild with its current and last-good pointers', async () => {
		telemetry.serve({
			'/lite/protocols2': {
				chains: ['Ethereum'],
				parentProtocols: [],
				protocols: [
					{
						defillamaId: 'aave',
						name: 'aave',
						slug: 'aave',
						category: 'Lending',
						chains: ['Ethereum'],
						chainTvls: { Ethereum: { tvl: 100, tvlPrevDay: 100, tvlPrevWeek: 100, tvlPrevMonth: 100 } },
						extraTvl: {}
					}
				]
			}
		})

		const result = await getProtocolRankingsSnapshot({ ...args, chain: 'Ethereum' })

		expect(result.protocols).toHaveLength(1)
		expect(result.protocols[0].tvl.default.tvl).toBe(100)
		expect([...published.keys()].some((key) => key.endsWith(':latest'))).toBe(true)
		expect([...published.keys()].some((key) => key.endsWith(':last-good'))).toBe(true)
	})

	test('publishes a dimension-only chain whose protocols track TVL on other chains', async () => {
		// Derive Chain: Derive V2 has TVL on Base but only perps volume here, so no row has TVL on this chain.
		telemetry.serve({
			'/lite/protocols2': {
				chains: ['Base', 'Derive Chain'],
				parentProtocols: [{ id: 'parent#derive', name: 'Derive' }],
				protocols: [
					{
						defillamaId: 'derive-v2',
						name: 'Derive V2',
						slug: 'derive-v2',
						category: 'Derivatives',
						chains: ['Base'],
						chainTvls: { Base: { tvl: 100, tvlPrevDay: 100, tvlPrevWeek: 100, tvlPrevMonth: 100 } },
						extraTvl: {},
						parentProtocol: 'parent#derive'
					},
					{
						defillamaId: 'dream',
						name: 'Dream',
						slug: 'dream',
						category: 'Options',
						chains: [],
						chainTvls: {},
						extraTvl: {}
					}
				]
			}
		})

		const result = await getProtocolRankingsSnapshot({
			chain: 'Derive Chain',
			chainMetadata: { 'derive-chain': { id: 'lyra', name: 'Derive Chain' } },
			protocolMetadata: {
				'parent#derive': { displayName: 'Derive', chains: ['Derive Chain'], tvl: true },
				'derive-v2': { displayName: 'Derive V2', chains: ['Base', 'Derive Chain'], tvl: true },
				dream: { displayName: 'Dream', chains: ['Derive Chain'], tvl: false }
			},
			categoriesAndTagsMetadata: { configs: {} } as never
		})

		expect(result.protocols.map((row) => [row.id, row.tvl.default.tvl])).toEqual([
			['dream', null],
			['derive-v2', null]
		])
		expect([...published.keys()].some((key) => key.endsWith(':latest'))).toBe(true)
	})

	test('publishes an empty snapshot for a chain whose metadata lists no protocols', async () => {
		// Pearl has chain fees but no protocols, so an empty table is real data.
		telemetry.serve({ '/lite/protocols2': { protocols: [], chains: ['Ethereum', 'Pearl'], parentProtocols: [] } })

		const result = await getProtocolRankingsSnapshot({
			...args,
			chain: 'Pearl',
			chainMetadata: { pearl: { id: 'pearl', name: 'Pearl', protocolCount: 0 } as IChainMetadata }
		})

		expect(result.protocols).toEqual([])
		expect([...published.keys()].some((key) => key.endsWith(':latest'))).toBe(true)
	})

	test('never writes a snapshot that fails validation, and records the failure', async () => {
		telemetry.serve({ '/lite/protocols2': { protocols: [], chains: ['Ethereum', 'Base'], parentProtocols: [] } })

		await expect(getProtocolRankingsSnapshot({ ...args, chain: 'Polygon' })).rejects.toThrow(
			ProtocolRankingSnapshotValidationError
		)
		expect(published.size).toBe(0)
		expect((await telemetry.events()).filter((event) => event.type === 'runtime_error')).toHaveLength(1)
	})

	test('serves :last-good when validation fails and :latest is gone', async () => {
		const { gzipSync } = await import('node:zlib')
		const healthy = {
			chain: 'Base',
			createdAt: 1,
			snapshot: 'bK3f9Qm2xLpR7Bn0Wc-U',
			protocols: [protocol('aave', 100)],
			availableActivityMetrics: [],
			source: {
				chains: ['Base'],
				feeProtocols: null,
				dexs: { total24h: 1, total7d: 7, change_7dover7d: 0, recentChart: [] },
				perps: { total24h: 1 }
			}
		}
		cacheMocks.getObjectCache.mockImplementation(async (key: string) =>
			key.endsWith(':last-good') ? { version: healthy.snapshot } : null
		)
		cacheMocks.getCache.mockResolvedValue({
			Key: 'k',
			Body: gzipSync(Buffer.from(JSON.stringify(healthy))),
			ContentType: 'application/json+gzip'
		})
		telemetry.serve({ '/lite/protocols2': { protocols: [], chains: ['Ethereum', 'Base'], parentProtocols: [] } })

		const result = await getProtocolRankingsSnapshot({ ...args, chain: 'Base' })

		expect(result.snapshot).toBe(healthy.snapshot)
		expect(published.size).toBe(0)
		expect((await telemetry.events()).filter((event) => event.type === 'runtime_error')).toHaveLength(1)
	})

	test('serves a current snapshot without fetching upstream data', async () => {
		const { gzipSync } = await import('node:zlib')
		const current = {
			chain: 'Tron',
			createdAt: 1,
			snapshot: 'cK3f9Qm2xLpR7Bn0Wc-V',
			protocols: [protocol('justlend', 100)],
			availableActivityMetrics: [],
			source: { chains: ['Tron'], feeProtocols: null, dexs: null, perps: null }
		}
		cacheMocks.getObjectCache.mockImplementation(async (key: string) =>
			key.endsWith(':latest') ? { version: current.snapshot } : null
		)
		cacheMocks.getCache.mockResolvedValue({
			Key: 'k',
			Body: gzipSync(Buffer.from(JSON.stringify(current))),
			ContentType: 'application/json+gzip'
		})

		const result = await getProtocolRankingsSnapshot({ ...args, chain: 'Tron' })

		expect(result.snapshot).toBe(current.snapshot)
		expect(telemetry.requests).toEqual([])
	})
})
