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

function serveNullTvlProtocols(data: { protocols: Array<IProtocol>; chains: Array<string> }) {
	const chain = data.chains[0]
	const protocols = data.protocols.flatMap((parent) =>
		(parent.childProtocols ?? [parent]).map((row) => ({
			defillamaId: row.id,
			name: row.name,
			slug: row.slug,
			chains: [chain],
			chainTvls: { [chain]: { tvl: null, tvlPrevDay: null, tvlPrevWeek: null, tvlPrevMonth: null } },
			extraTvl: {},
			parentProtocol: parent.childProtocols ? parent.id : undefined
		}))
	)
	telemetry.serve({
		'/lite/protocols2': {
			chains: data.chains,
			protocols,
			parentProtocols: data.protocols.filter((row) => row.childProtocols).map((row) => ({ id: row.id, name: row.name }))
		}
	})
}

const healthyContext = { expectDexs: true, expectPerps: true, previousProtocolCount: null }

describe('assertPublishableSnapshot', () => {
	test('rejects an empty protocols list', () => {
		expect(() => assertPublishableSnapshot(snapshot({ protocols: [] }), healthyContext)).toThrow(
			ProtocolRankingSnapshotValidationError
		)
	})

	test('rejects a snapshot where every TVL is null', () => {
		expect(() => assertPublishableSnapshot(snapshot({ protocols: [protocol('aave', null)] }), healthyContext)).toThrow(
			/TVL/
		)
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

	test('publishes a dimension-only chain snapshot without TVL', async () => {
		serveNullTvlProtocols({
			protocols: [protocol('native-core-clob', null)],
			chains: ['Native Core']
		})

		const result = await getProtocolRankingsSnapshot({
			chain: 'Native Core',
			chainMetadata: { 'native-core': { id: 'native_core', name: 'Native Core' } },
			protocolMetadata: { 'native-core-clob': { displayName: 'native-core-clob', chains: [], tvl: false } },
			categoriesAndTagsMetadata: { configs: {} } as never
		})

		expect(result.protocols).toHaveLength(1)
		expect([...published.keys()].some((key) => key.endsWith(':latest'))).toBe(true)
	})

	test('publishes a dimension-only chain whose protocols are all grouped', async () => {
		const groupedProtocol = {
			...protocol('parent#dimension-only', null),
			childProtocols: [protocol('dimension-dex', null), protocol('dimension-perps', null)]
		}
		serveNullTvlProtocols({
			protocols: [groupedProtocol],
			chains: ['Grouped Dimensions']
		})

		const result = await getProtocolRankingsSnapshot({
			chain: 'Grouped Dimensions',
			chainMetadata: { 'grouped-dimensions': { id: 'grouped-dimensions', name: 'Grouped Dimensions' } },
			protocolMetadata: {
				'parent#dimension-only': { displayName: 'parent#dimension-only', chains: [], tvl: true },
				'dimension-dex': { displayName: 'dimension-dex', chains: [], tvl: false },
				'dimension-perps': { displayName: 'dimension-perps', chains: [], tvl: false }
			},
			categoriesAndTagsMetadata: { configs: {} } as never
		})

		expect(result.protocols).toMatchObject([
			{ id: 'parent#dimension-only', childProtocols: [{ id: 'dimension-dex' }, { id: 'dimension-perps' }] }
		])
		expect([...published.keys()].some((key) => key.endsWith(':latest'))).toBe(true)
		expect([...published.keys()].some((key) => key.endsWith(':last-good'))).toBe(true)
	})

	test.each([true, undefined])('rejects missing grouped TVL when child TVL metadata is %s', async (tvl) => {
		const chain = `Grouped Outage ${String(tvl)}`
		const chainKey = `grouped-outage-${String(tvl)}`
		serveNullTvlProtocols({
			protocols: [
				protocol('standalone-dimension', null),
				{
					...protocol('parent#grouped-outage', null),
					childProtocols: [protocol('grouped-dimension', null), protocol('grouped-tvl', null)]
				}
			],
			chains: [chain]
		})

		await expect(
			getProtocolRankingsSnapshot({
				chain,
				chainMetadata: { [chainKey]: { id: chainKey, name: chain } },
				protocolMetadata: {
					'standalone-dimension': { displayName: 'standalone-dimension', chains: [], tvl: false },
					'parent#grouped-outage': { displayName: 'parent#grouped-outage', chains: [], tvl: false },
					'grouped-dimension': { displayName: 'grouped-dimension', chains: [], tvl: false },
					'grouped-tvl': { displayName: 'grouped-tvl', chains: [], tvl }
				},
				categoriesAndTagsMetadata: { configs: {} } as never
			})
		).rejects.toThrow(/TVL/)
		expect(published.size).toBe(0)
	})

	test('still rejects an all-null TVL rebuild for a TVL-backed chain', async () => {
		serveNullTvlProtocols({
			protocols: [protocol('aave', null)],
			chains: ['TVL Outage']
		})

		await expect(
			getProtocolRankingsSnapshot({
				chain: 'TVL Outage',
				chainMetadata: { 'tvl-outage': { id: 'tvl-outage', name: 'TVL Outage' } },
				protocolMetadata: { aave: { displayName: 'aave', chains: [], tvl: true } },
				categoriesAndTagsMetadata: { configs: {} } as never
			})
		).rejects.toThrow(/TVL/)
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
