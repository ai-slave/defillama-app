import { beforeEach, describe, expect, test, vi } from 'vitest'
import { YIELDS_V2_SERVER_URL } from '~/constants'
import type { VerifiedBlock, YieldsMeta } from '~/containers/Yields/data/types'
import type { BorrowMarketDetail, PoolDetail } from '~/containers/Yields/poolDetail/types'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { earnRow } from '~/utils/testing/yieldsEarnFixture'
import { installYieldsFixtures, yieldsSnapshot } from '~/utils/testing/yieldsSnapshotFixture'

const { acquireYieldsSnapshot, validateSubscription } = vi.hoisted(() => ({
	acquireYieldsSnapshot: vi.fn(),
	validateSubscription: vi.fn()
}))
vi.mock('~/containers/Yields/server/dataset.server', () => ({ acquireYieldsSnapshot }))
vi.mock('~/utils/apiAuth', () => ({ validateSubscription }))
// getServerSideProps renders nothing; the page tree only costs import time here.
vi.mock('~/layout', () => ({ default: () => null }))
vi.mock('~/containers/Yields/poolDetail/PoolDetailView', () => ({ PoolDetailView: () => null }))

import { getServerSideProps } from '~/pages/yields/pool/[pool]'

const http = installYieldsFixtures()

type PageContext = Parameters<typeof getServerSideProps>[0]

const META: YieldsMeta = {
	chains: [{ slug: 'ethereum', name: 'Ethereum', is_evm: true }],
	protocols: [{ slug: 'lido', name: 'Lido', category: 'Liquid Staking', has_audit: true, potential_airdrop: false }],
	categories: [{ slug: 'liquid-staking', name: 'Liquid Staking' }],
	tokens: { families: [], assets: [] },
	halal: [],
	meme_pool_ids: []
}

const MEASURED: VerifiedBlock = {
	apy: { avg_1d: 2.4, avg_7d: 2.3, avg_30d: 2.2 },
	apy_as_of: '2026-09-01T00:00:00Z',
	apy_confidence: 'high',
	exit: { status: 'queued', eta_seconds: 259_200, fee_bps: 0, as_of: null },
	exit_liquidity: null,
	tvl: null
} as VerifiedBlock

// The detail fetch is memoized by id for the life of the module, so every case uses its own pool.
let poolCounter = 0
const nextPoolId = () => `a1a1a1a1-0000-4000-8000-${String(++poolCounter).padStart(12, '0')}`

const earnUrl = (id: string) => `${YIELDS_V2_SERVER_URL}/v2/earn/${id}`
const verifiedUrl = (id: string) => `${YIELDS_V2_SERVER_URL}/v2/earn/verified/${id}`
const marketUrl = (id: string) => `${YIELDS_V2_SERVER_URL}/v2/borrow/markets/${id}`

function detailFixture(id: string, overrides: Partial<PoolDetail> = {}): PoolDetail {
	return {
		id,
		pool_key: 'k',
		pool_token: { address: '0xabc', symbol: 'stETH', name: 'Lido' },
		display: { label: 'stETH', detail: 'Liquid staked Ether 2.0' },
		reference_asset_symbol: 'ETH',
		url: 'https://lido.fi',
		protocol: 'Lido',
		chain: 'Ethereum',
		underlying_tokens: [],
		reward_tokens: [],
		tvl_usd: 1000,
		apy: {
			current: { base: 2.3, reward: null, total: 2.3 },
			avg_7d: { base: 2.2, reward: null, total: 2.2 },
			avg_30d: { base: 2.1, reward: null, total: 2.1 }
		},
		intrinsic: null,
		stability_30d: { base: 0.9, base_reward: 0.9, base_intrinsic: 0.9, base_reward_intrinsic: 0.9 },
		holders: {
			count: null,
			avg_position_usd: null,
			top_10_share_pct: null,
			count_change_7d: null,
			count_change_30d: null,
			top_10_holders: null
		},
		price_per_share: 1,
		volume_1d_usd: null,
		available_supply_usd: null,
		attributes: { stablecoin_only: false, single_asset_exposure: true, impermanent_loss_risk: false },
		available_history: { supply: false, borrow: false },
		...overrides
	}
}

// `/v2/borrow/markets/:id` detail shape for a borrow-only market (no earn row).
function marketFixture(id: string): BorrowMarketDetail {
	const zero = { base: 0, reward: null, total: 0 }
	const cost = { base: 4.3, reward: null, total: 4.3 }
	return {
		id,
		pool_key: 'plasma_0x99',
		pool_token: { address: '0x991416', symbol: null, name: null },
		display: { label: 'weETH / GHO', detail: null },
		url: 'https://fluid.io/vaults/9745/24',
		protocol: 'Lido',
		chain: 'Ethereum',
		collateral_token: { address: '0xa3', symbol: 'weETH', decimals: 18 },
		borrow_token: { address: '0xb7', symbol: 'GHO', decimals: 18 },
		reward_tokens: [],
		loan_to_value: 0.75,
		total_supply_usd: 5,
		total_borrow_usd: 5,
		available_borrow_usd: 100_480,
		supply_apy: { current: zero, avg_7d: zero, avg_30d: zero },
		borrow_cost_apy: { current: cost, avg_7d: cost, avg_30d: cost },
		intrinsic: { supply: null, borrow: null },
		available_history: { supply: false, borrow: true }
	}
}

/** A snapshot whose verified sidecar lists `measuredIds`, which is what makes a pool "measured". */
function serveSnapshot(measuredIds: Array<string> = []) {
	acquireYieldsSnapshot.mockResolvedValue(
		yieldsSnapshot({
			earn: measuredIds.map((id) => earnRow(id, 1000)),
			earnVerified: measuredIds.map((id) => ({ ...MEASURED, id })),
			meta: META
		})
	)
}

function page(
	pool: string | undefined,
	{ cookies = {}, query = {} }: { cookies?: Record<string, string>; query?: Record<string, string> } = {}
) {
	const headers: Record<string, string> = {}
	const context = {
		req: { method: 'GET', cookies, headers: {} },
		resolvedUrl: pool ? `/yields/pool/${pool}` : '/yields/pool/',
		params: pool ? { pool } : {},
		query,
		res: { setHeader: (name: string, value: string) => (headers[name] = value) }
	} as unknown as PageContext
	return { run: () => getServerSideProps(context), headers }
}

async function propsOf(result: Awaited<ReturnType<typeof getServerSideProps>>) {
	if (!('props' in result)) throw new Error('Expected props')
	return await result.props
}

const data = (body: unknown) => ({ data: body })

beforeEach(() => {
	acquireYieldsSnapshot.mockReset()
	validateSubscription.mockReset()
	serveSnapshot()
	vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('/yields/pool/[pool]', () => {
	test('a missing or malformed pool id is not found without asking upstream', async () => {
		for (const pool of [undefined, '1:11']) {
			const { run, headers } = page(pool)
			expect(await run()).toEqual({ notFound: true })
			expect(headers).toEqual({})
		}
		expect(http.urls()).toEqual([])
	})

	test('a pool neither the earn nor the borrow-market endpoint knows is not found', async () => {
		const id = nextPoolId()
		http.serve({ [earnUrl(id)]: fixtureStatus(404), [marketUrl(id)]: fixtureStatus(404) })
		const { run, headers } = page(id)

		expect(await run()).toEqual({ notFound: true })
		expect(headers).toEqual({})
	})

	test('an upstream 400 for a well-formed id is an error, not a not-found', async () => {
		const id = nextPoolId()
		http.serve({ [earnUrl(id)]: fixtureStatus(400) })

		await expect(page(id).run()).rejects.toThrow(`yields 400: ${earnUrl(id)}`)
		expect(http.urls()).not.toContain(marketUrl(id))
	})

	test('a borrow-only market renders from the borrow-market detail and its borrow history', async () => {
		const id = nextPoolId()
		const cost = { base: 4.3, reward: null, total: 4.3 }
		http.serve({
			[earnUrl(id)]: fixtureStatus(404),
			[marketUrl(id)]: data(marketFixture(id)),
			[`${marketUrl(id)}/history`]: data([
				{
					date: '2026-06-01',
					total_borrow_usd: 5,
					available_borrow_usd: 100_480,
					borrow_cost_apy: { avg_1d: cost, avg_7d: cost, avg_30d: cost },
					intrinsic: null
				}
			])
		})
		const { run, headers } = page(id)

		const props = await propsOf(await run())

		expect(props).toMatchObject({
			mode: 'borrow',
			poolId: id,
			symbol: 'weETH / GHO',
			// Entity facts joined from meta the same way earn pools are.
			protocol: { slug: 'lido', name: 'Lido', category: 'Liquid Staking', has_audit: true },
			chain: { slug: 'ethereum', name: 'Ethereum' },
			supplyChart: null,
			stability: null,
			holders: null
		})
		expect(props.supply).toMatchObject({ apyLabel: 'Supply APY', metrics: [{ label: 'Total supplied', value: 5 }] })
		expect(props.borrow).toMatchObject({
			apyLabel: 'Borrow APY',
			apy: { base: 4.3 },
			metrics: [
				{ label: 'Total borrowed', value: 5 },
				{ label: 'Available', value: 100_480 },
				{ label: 'Max LTV', value: 0.75, format: 'ltv' }
			]
		})
		expect(props.borrowChart).not.toBeNull()
		expect(headers['cache-control']).toBe('public, s-maxage=300, stale-while-revalidate=600')
	})

	test('an earn pool joins slug, category and audit from meta and skips a history it does not have', async () => {
		const id = nextPoolId()
		http.serve({ [earnUrl(id)]: data(detailFixture(id)) })

		const props = await propsOf(await page(id).run())

		expect(props).toMatchObject({
			poolId: id,
			symbol: 'stETH',
			protocol: { slug: 'lido', name: 'Lido', category: 'Liquid Staking', has_audit: true },
			chain: { slug: 'ethereum', name: 'Ethereum' },
			stability: { score: 0.9, rating: 'stable' },
			supplyChart: null
		})
		expect(props.supply).toMatchObject({ apy: { base: 2.1 }, metrics: [{ label: 'TVL', value: 1000 }] })
		expect(http.urls().filter((url) => url.includes('/history'))).toEqual([])
	})

	test('an unmeasured pool fetches only the requested reported range', async () => {
		const id = nextPoolId()
		http.serve({
			[earnUrl(id)]: data(detailFixture(id, { available_history: { supply: true, borrow: false } })),
			[`${earnUrl(id)}/history?range=30d`]: data([])
		})

		await page(id, { query: { range: '30d', growthRange: '30d', liquidityRange: '30d' } }).run()

		expect(http.urls().filter((url) => url.includes('/history'))).toEqual([`${earnUrl(id)}/history?range=30d`])
	})
})

// The measured block only reaches the HTML for a request that proves an active subscription.
describe('entitlement on first paint', () => {
	function measuredPool(overrides: Partial<PoolDetail> = {}) {
		const id = nextPoolId()
		serveSnapshot([id])
		http.serve({ [earnUrl(id)]: data(detailFixture(id, overrides)), [verifiedUrl(id)]: data(MEASURED) })
		return id
	}

	test('an anonymous request is locked and publicly cached, without reading the measurement', async () => {
		const id = measuredPool()
		const { run, headers } = page(id)

		const props = await propsOf(await run())

		expect(props.verified).toBeNull()
		expect(props.verifiedLocked).toBe(true)
		expect(http.urls()).not.toContain(verifiedUrl(id))
		expect(headers).toMatchObject({
			'cache-control': 'public, s-maxage=300, stale-while-revalidate=600',
			Vary: 'Cookie, Authorization'
		})
	})

	test('a subscriber gets the measured page, kept out of the shared cache', async () => {
		const id = measuredPool()
		validateSubscription.mockImplementation(async (auth: string) =>
			auth === 'Bearer tok' ? { valid: true, isTrial: false } : { valid: false, status: 401 }
		)
		const { run, headers } = page(id, { cookies: { pb_auth_token: 'tok' } })

		const props = await propsOf(await run())

		expect(props.verified?.apy.avg_1d).toBe(2.4)
		expect(props.verifiedLocked).toBe(false)
		expect(headers['cache-control']).toBe('private, no-store')
	})

	test('a subscriber fetches the max history once and the page slices the requested range from it', async () => {
		const id = measuredPool({ available_history: { supply: true, borrow: false } })
		http.serve({
			[`${earnUrl(id)}/history?range=max`]: data([]),
			[`${verifiedUrl(id)}/history?range=max`]: data([])
		})
		validateSubscription.mockResolvedValue({ valid: true, isTrial: false })

		await page(id, {
			cookies: { pb_auth_token: 'tok' },
			query: { range: '30d', growthRange: '30d', liquidityRange: '30d' }
		}).run()

		expect(http.urls().filter((url) => url.includes('/history'))).toEqual([
			`${earnUrl(id)}/history?range=max`,
			`${verifiedUrl(id)}/history?range=max`
		])
	})

	test.each([
		['network', () => validateSubscription.mockRejectedValue(new Error('auth service unavailable'))],
		[
			'http',
			() =>
				validateSubscription.mockResolvedValue({ valid: false, status: 503, error: 'Subscription service unavailable' })
		]
	])('an unreachable entitlement check stays neutral (%s)', async (_failure, fail) => {
		const id = measuredPool()
		fail()
		const { run, headers } = page(id, { cookies: { pb_auth_token: 'tok' } })

		const props = await propsOf(await run())

		expect(props.verified).toBeNull()
		expect(props.verifiedLocked).toBeNull()
		expect(headers['cache-control']).toBe('private, no-store')
	})

	test('a signed-in reader without a subscription is locked, still privately', async () => {
		const id = measuredPool()
		validateSubscription.mockResolvedValue({ valid: false, status: 403, error: 'Active subscription required' })
		const { run, headers } = page(id, { cookies: { pb_auth_token: 'tok' } })

		const props = await propsOf(await run())

		expect(props.verified).toBeNull()
		expect(props.verifiedLocked).toBe(true)
		expect(headers['cache-control']).toBe('private, no-store')
	})
})
