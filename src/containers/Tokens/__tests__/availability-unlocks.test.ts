import { describe, expect, it, vi } from 'vitest'
import type { EmissionEvent } from '~/containers/Unlocks/api.types'
import type { EnrichedProtocolEmission } from '~/containers/Unlocks/queries'
import { createMetadataCacheFromArtifacts, METADATA_CI_STUBS } from '~/utils/metadata/artifactContract'
import { buildTokensSourceRows, fetchTokensSourceRows } from '../queries.server'
import { getTokensPageFromRows } from '../utils'

const mocks = vi.hoisted(() => ({ fees: vi.fn(), rights: vi.fn(), unlocks: vi.fn() }))
vi.mock('~/containers/AdapterMetrics/api', () => ({ fetchAdapterChainMetrics: mocks.fees }))
vi.mock('~/containers/TokenRights/server/dataset.server', () => ({ fetchTokenRightsEntries: mocks.rights }))
vi.mock('~/containers/Unlocks/queries', () => ({ getAllProtocolEmissions: mocks.unlocks }))

const day = 86400
const nowSec = 1_800_000_000
const metadata = createMetadataCacheFromArtifacts({
	...METADATA_CI_STUBS,
	tokenDirectory: {
		sample: { name: 'Sample', symbol: 'S', route: '/token/S', token_nk: 'coingecko:sample', protocolId: 'sample' }
	}
})
const tokens = [{ id: 'sample', name: 'Sample', symbol: 's', market_cap: 100, current_price: 2 }]
const base = {
	tokens,
	markets: { last_updated: '', tokens: [] },
	tokenRightsEntries: [],
	fees: [],
	revenue: [],
	holdersRevenue: [],
	metadata,
	nowSec
}

function emission(events: EmissionEvent[], tPrice: number | null = 2): EnrichedProtocolEmission {
	return {
		name: 'Sample',
		token: 'S',
		sources: [],
		protocolId: null,
		gecko_id: 'sample',
		circSupply: 50,
		circSupply30d: 40,
		maxSupply: 100,
		totalLocked: 50,
		unlocksPerDay: null,
		unlockEvents: null,
		events,
		tPrice,
		tSymbol: 'S',
		historicalPrice: [],
		lastEvent: [],
		upcomingEvent: [],
		next24h: { cliff: 0, linear: 0, total: 0, unknownEventCount: 0 }
	}
}
function cliff(timestamp: number, amount: number): EmissionEvent {
	return { description: 'Cliff', category: 'insiders', unlockType: 'cliff', timestamp, noOfTokens: [amount] }
}

describe('Tokens rolling unlock windows', () => {
	it('includes old linear schedules and all future cliffs, using disjoint half-open windows', () => {
		const events: EmissionEvent[] = [
			{
				description: 'Linear',
				category: 'farming',
				unlockType: 'linear',
				timestamp: nowSec - 60 * day,
				noOfTokens: [0, 70],
				rateDurationDays: 120
			},
			cliff(nowSec - 30 * day, 10),
			cliff(nowSec, 20),
			cliff(nowSec + 10 * day, 30),
			cliff(nowSec + 30 * day, 1000),
			cliff(nowSec - 31 * day, 1000),
			cliff(nowSec + day, -100)
		]
		const result = buildTokensSourceRows({ ...base, unlocks: [emission(events)] })
		expect(result.rows[0]).toMatchObject({ unlock30dUsd: 620, upcomingUnlockUsd: 700 })
		expect(result.stats).toMatchObject({ unlock30dUsd: 620, upcomingUnlockUsd: 700 })
	})
	it('preserves known zero, unsupported tokens, missing prices and unknown event coverage', () => {
		const zero = buildTokensSourceRows({ ...base, unlocks: [emission([])] })
		expect(zero.rows[0]).toMatchObject({ unlock30dUsd: 0, upcomingUnlockUsd: 0 })
		const missing = buildTokensSourceRows({ ...base, unlocks: [] })
		expect(missing.rows[0]?.unlock30dUsd).toBeNull()
		const unpriced = buildTokensSourceRows({ ...base, unlocks: [emission([cliff(nowSec, 5)], null)] })
		expect(unpriced.rows[0]?.upcomingUnlockUsd).toBeNull()
		const unknown: EmissionEvent = {
			description: 'Undisclosed',
			category: 'insiders',
			unlockType: 'cliff',
			timestamp: nowSec,
			noOfTokens: [],
			hasUnknownTokenAmount: true
		}
		const result = buildTokensSourceRows({ ...base, unlocks: [emission([unknown])] })
		expect(result.rows[0]?.upcomingUnlockUsd).toBeNull()
		const mixed = buildTokensSourceRows({ ...base, unlocks: [emission([unknown, cliff(nowSec, 5)])] })
		expect(mixed.rows[0]?.upcomingUnlockUsd).toBe(10)
	})
})

describe('Tokens source availability', () => {
	it('keeps optional outages distinct from successful empty responses without losing core rows', async () => {
		const snapshot = {
			tokens,
			markets: base.markets,
			currentMetricsById: {},
			tokenIndexById: new Map<string, number>(),
			version: 'test',
			generatedAt: nowSec * 1000
		}
		mocks.fees.mockResolvedValue({ protocols: [] })
		mocks.rights.mockResolvedValue([])
		mocks.unlocks.mockResolvedValue([])
		const empty = await fetchTokensSourceRows(snapshot, metadata)
		expect(empty.unavailableSources).toEqual([])
		expect(empty.stats).toMatchObject({ spotVolume24h: 0, unlock30dUsd: 0 })
		mocks.fees.mockRejectedValue(new Error('outage'))
		mocks.rights.mockRejectedValue(new Error('outage'))
		mocks.unlocks.mockRejectedValue(new Error('outage'))
		const failed = await fetchTokensSourceRows({ ...snapshot, markets: null }, metadata)
		expect(failed.unavailableSources).toEqual(['markets', 'rights', 'fees', 'revenue', 'holdersRevenue', 'unlocks'])
		expect(failed.stats).toMatchObject({
			totalMarketCap: 100,
			spotVolume24h: null,
			perpsVolume24h: null,
			openInterest24h: null,
			unlock30dUsd: null,
			upcomingUnlockUsd: null
		})
		expect(failed.rows[0]).toMatchObject({ id: 'sample', marketCap: 100, price: 2 })
		const page = getTokensPageFromRows(
			failed.rows,
			failed.sortIndexes,
			{ min_unlock30dUsd: '0' },
			{ ...failed, snapshotVersion: null }
		)
		expect(page.rows).toEqual([])
		expect(page.unavailableSources).toContain('unlocks')
		expect(page.statsDisplay.unlock30dUsd).toBeNull()
	})
	it('a single failed source leaves successful zero activity and the other totals available', () => {
		const result = buildTokensSourceRows({ ...base, unlocks: null })
		expect(result.unavailableSources).toEqual(['unlocks'])
		expect(result.stats.spotVolume24h).toBe(0)
		expect(result.stats.unlock30dUsd).toBeNull()
	})
})
