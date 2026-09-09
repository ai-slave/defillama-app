import { beforeEach, describe, expect, test, vi } from 'vitest'

const cacheMocks = vi.hoisted(() => ({
	getCache: vi.fn(),
	setCache: vi.fn(),
	getObjectCache: vi.fn(),
	setObjectCache: vi.fn()
}))
const telemetryMocks = vi.hoisted(() => ({ recordRuntimeError: vi.fn() }))
const queriesMocks = vi.hoisted(() => ({ getProtocolsByChain: vi.fn() }))

vi.mock('~/utils/cache-client', () => cacheMocks)
vi.mock(import('~/utils/telemetry'), async (importOriginal) => ({
	...(await importOriginal()),
	recordRuntimeError: telemetryMocks.recordRuntimeError
}))
vi.mock('../queries.server', () => queriesMocks)

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

const healthyContext = { expectDexs: true, expectPerps: true, previousProtocolCount: null }

describe('assertPublishableSnapshot', () => {
	test('accepts a healthy snapshot', () => {
		expect(() => assertPublishableSnapshot(snapshot(), healthyContext)).not.toThrow()
	})

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

	test('accepts an explicitly dimension-only snapshot with no TVL', () => {
		expect(() =>
			assertPublishableSnapshot(snapshot({ chain: 'Native Core', protocols: [protocol('native-core-clob', null)] }), {
				...healthyContext,
				allowNoTvl: true
			})
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
		protocolMetadata: {},
		categoriesAndTagsMetadata: {
			configs: { Dexs: { chains: ['1', '137'] }, Derivatives: { chains: ['1', '137'] } }
		} as never
	}

	beforeEach(() => {
		vi.resetAllMocks()
		cacheMocks.getObjectCache.mockResolvedValue(null)
		cacheMocks.getCache.mockResolvedValue(null)
	})

	test('publishes a healthy rebuild, blob before pointer', async () => {
		cacheMocks.setCache.mockResolvedValue(true)
		cacheMocks.setObjectCache.mockResolvedValue(true)
		queriesMocks.getProtocolsByChain.mockResolvedValue({
			protocols: [protocol('aave', 100)],
			chains: ['Ethereum'],
			parentProtocols: [],
			fees: null,
			dexs: { total24h: 1, total7d: 7, change_7dover7d: 0, totalDataChart: [] },
			perps: { total24h: 1 }
		})

		const result = await getProtocolRankingsSnapshot({ ...args, chain: 'Ethereum' })

		expect(result.protocols).toHaveLength(1)
		expect(cacheMocks.setCache).toHaveBeenCalledTimes(1)
		// :latest and :last-good
		expect(cacheMocks.setObjectCache).toHaveBeenCalledTimes(2)
		expect(cacheMocks.setCache.mock.invocationCallOrder[0]).toBeLessThan(
			cacheMocks.setObjectCache.mock.invocationCallOrder[0] ?? Infinity
		)
	})

	test('publishes a dimension-only chain snapshot without TVL', async () => {
		cacheMocks.setCache.mockResolvedValue(true)
		cacheMocks.setObjectCache.mockResolvedValue(true)
		queriesMocks.getProtocolsByChain.mockResolvedValue({
			protocols: [protocol('native-core-clob', null)],
			chains: ['Native Core'],
			parentProtocols: [],
			fees: null,
			dexs: null,
			perps: null
		})

		const result = await getProtocolRankingsSnapshot({
			chain: 'Native Core',
			chainMetadata: { 'native-core': { id: 'native_core', name: 'Native Core' } },
			protocolMetadata: { 'native-core-clob': { tvl: false } },
			categoriesAndTagsMetadata: { configs: {} } as never
		})

		expect(result.protocols).toHaveLength(1)
		expect(cacheMocks.setCache).toHaveBeenCalledTimes(1)
	})

	test('still rejects an all-null TVL rebuild for a TVL-backed chain', async () => {
		queriesMocks.getProtocolsByChain.mockResolvedValue({
			protocols: [protocol('aave', null)],
			chains: ['TVL Outage'],
			parentProtocols: [],
			fees: null,
			dexs: null,
			perps: null
		})

		await expect(
			getProtocolRankingsSnapshot({
				chain: 'TVL Outage',
				chainMetadata: { 'tvl-outage': { id: 'tvl-outage', name: 'TVL Outage' } },
				protocolMetadata: { aave: { tvl: true } },
				categoriesAndTagsMetadata: { configs: {} } as never
			})
		).rejects.toThrow(/TVL/)
	})

	test('never writes a snapshot that fails validation, and records the failure', async () => {
		queriesMocks.getProtocolsByChain.mockResolvedValue({
			protocols: [],
			chains: ['Ethereum'],
			parentProtocols: [],
			fees: null,
			dexs: null,
			perps: null
		})

		await expect(getProtocolRankingsSnapshot({ ...args, chain: 'Polygon' })).rejects.toThrow(
			ProtocolRankingSnapshotValidationError
		)
		expect(cacheMocks.setCache).not.toHaveBeenCalled()
		expect(cacheMocks.setObjectCache).not.toHaveBeenCalled()
		expect(telemetryMocks.recordRuntimeError).toHaveBeenCalledTimes(1)
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
		queriesMocks.getProtocolsByChain.mockResolvedValue({
			protocols: [],
			chains: ['Base'],
			parentProtocols: [],
			fees: null,
			dexs: null,
			perps: null
		})

		const result = await getProtocolRankingsSnapshot({ ...args, chain: 'Base' })

		expect(result.snapshot).toBe(healthy.snapshot)
		expect(cacheMocks.setCache).not.toHaveBeenCalled()
		expect(telemetryMocks.recordRuntimeError).toHaveBeenCalledTimes(1)
	})

	test('never consults :last-good on the ordinary freshness path', async () => {
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
		expect(queriesMocks.getProtocolsByChain).not.toHaveBeenCalled()
		const pointerReads = cacheMocks.getObjectCache.mock.calls.map((call) => call[0])
		expect(pointerReads.some((key) => key.endsWith(':last-good'))).toBe(false)
	})
})
