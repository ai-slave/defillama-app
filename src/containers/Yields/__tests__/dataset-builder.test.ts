import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { YIELDS_V2_SERVER_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { YIELDS_SNAPSHOT_FILES } from '../data/snapshot.contract'
import { buildYieldsSnapshotCandidate } from '../server/dataset.builder.server'

const http = installFixtureFetch()

let warn: ReturnType<typeof vi.spyOn>

beforeAll(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterAll(() => warn.mockRestore())

function validMeta() {
	return {
		chains: [{ slug: 'ethereum', name: 'Ethereum', is_evm: true }],
		protocols: [{ slug: 'aave-v3', name: 'Aave V3', category: 'Lending', has_audit: true, potential_airdrop: false }],
		categories: [{ slug: 'lending', name: 'Lending' }],
		tokens: { families: [{ value: 'family:eth', symbol: 'ETH' }], assets: [] },
		halal: [],
		meme_pool_ids: []
	}
}

const ENDPOINTS = {
	earn: '/v2/earn',
	earnVerified: '/v2/earn/verified',
	trends: '/v2/earn/trends',
	borrowMarkets: '/v2/borrow/markets',
	borrowRoutes: '/v2/borrow/routes',
	loops: '/v2/loops',
	tokenKeys: '/v2/tokens',
	meta: '/v2/meta',
	depegs: '/v2/depegs',
	exploits: '/v2/exploits'
} as const

const feeds = (): Record<keyof typeof ENDPOINTS, unknown> => ({
	earn: [{ id: 'earn' }],
	earnVerified: [{ id: 'earn' }],
	trends: [{ id: 'trend' }],
	borrowMarkets: [{ id: 'borrow-market' }],
	borrowRoutes: [{ collateral: { id: 'collateral' }, borrow: { id: 'borrow' } }],
	loops: [{ id: 'loop' }],
	tokenKeys: [{ id: 'token-key' }],
	meta: validMeta(),
	depegs: [],
	exploits: []
})

/** Serves every feed in its `{ data }` envelope; an override may be a fixture instead of a body. */
function serveFeeds(overrides: Partial<Record<keyof typeof ENDPOINTS, unknown>> = {}) {
	const bodies = { ...feeds(), ...overrides }
	const routes: Record<string, unknown> = {}
	for (const key in ENDPOINTS) {
		const name = key as keyof typeof ENDPOINTS
		const body = bodies[name]
		routes[`${YIELDS_V2_SERVER_URL}${ENDPOINTS[name]}`] = typeof body === 'function' ? body : { data: body }
	}
	http.serve(routes)
}

// A 404 fails without the retry backoff a 5xx would wait through.
const unavailable = fixtureStatus(404)

beforeEach(() => {
	warn.mockClear()
})

describe('Yields v2 snapshot builder', () => {
	test('writes every feed to its artifact while allowing empty optional feeds', async () => {
		serveFeeds()
		const writeJson = vi.fn().mockResolvedValue(undefined)

		await buildYieldsSnapshotCandidate({ writeJson })

		const expected = feeds()
		expect(writeJson.mock.calls).toEqual(
			(Object.keys(YIELDS_SNAPSHOT_FILES) as Array<keyof typeof YIELDS_SNAPSHOT_FILES>).map((key) => [
				YIELDS_SNAPSHOT_FILES[key],
				expected[key]
			])
		)
	})

	test('publishes reported yields with an empty verified sidecar', async () => {
		serveFeeds({ earnVerified: [] })
		const writeJson = vi.fn().mockResolvedValue(undefined)

		await buildYieldsSnapshotCandidate({ writeJson })

		expect(writeJson).toHaveBeenCalledWith(YIELDS_SNAPSHOT_FILES.earnVerified, [])
	})

	test('fails the generation when the verified request fails, like every other feed', async () => {
		serveFeeds({ earnVerified: unavailable })
		const writeJson = vi.fn().mockResolvedValue(undefined)

		await expect(buildYieldsSnapshotCandidate({ writeJson })).rejects.toThrow(
			/^Yields snapshot requests failed:\nearn verified: .*\[404\]/
		)
		expect(writeJson).not.toHaveBeenCalled()
	})

	test('does not write a partial candidate when an endpoint fails', async () => {
		serveFeeds({ borrowRoutes: unavailable })
		const writeJson = vi.fn().mockResolvedValue(undefined)

		await expect(buildYieldsSnapshotCandidate({ writeJson })).rejects.toThrow(
			/^Yields snapshot requests failed:\nborrow routes: .*\[404\][^\n]*$/
		)
		expect(writeJson).not.toHaveBeenCalled()
	})

	test('reports every failed endpoint', async () => {
		serveFeeds({ trends: unavailable, meta: unavailable })
		const writeJson = vi.fn().mockResolvedValue(undefined)

		await expect(buildYieldsSnapshotCandidate({ writeJson })).rejects.toThrow(
			/^Yields snapshot requests failed:\ntrends: .*\[404\].*\nmeta: .*\[404\]/
		)
		expect(writeJson).not.toHaveBeenCalled()
	})

	test.each([
		['earn', 'earn'],
		['trends', 'trends'],
		['borrow markets', 'borrowMarkets'],
		['borrow routes', 'borrowRoutes'],
		['loops', 'loops'],
		['tokens', 'tokenKeys']
	] as const)('rejects an empty %s dataset without replacing the candidate', async (name, feed) => {
		serveFeeds({ [feed]: [] })
		const writeJson = vi.fn().mockResolvedValue(undefined)

		await expect(buildYieldsSnapshotCandidate({ writeJson })).rejects.toThrow(
			`Yields snapshot ${name} dataset is empty`
		)
		expect(writeJson).not.toHaveBeenCalled()
	})

	test('rejects empty core metadata', async () => {
		serveFeeds({ meta: { ...validMeta(), chains: [] } })
		const writeJson = vi.fn().mockResolvedValue(undefined)

		await expect(buildYieldsSnapshotCandidate({ writeJson })).rejects.toThrow('Yields snapshot metadata has no chains')
		expect(writeJson).not.toHaveBeenCalled()
	})

	test('rejects a generation whose default earn view is entirely hidden', async () => {
		serveFeeds({ meta: { ...validMeta(), meme_pool_ids: ['earn'] } })
		const writeJson = vi.fn().mockResolvedValue(undefined)

		await expect(buildYieldsSnapshotCandidate({ writeJson })).rejects.toThrow(
			'Yields snapshot earn dataset has no default-visible rows'
		)
		expect(writeJson).not.toHaveBeenCalled()
	})
})
