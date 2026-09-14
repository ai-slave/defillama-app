import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { BorrowMarketDetail, PoolDetail } from '~/containers/Yields/poolDetail/types'
import { getServerSideProps } from '~/pages/yields/pool/[pool]'

type PageContext = Parameters<typeof getServerSideProps>[0]

function pageContext(
	pool: string | undefined,
	res: { setHeader: ReturnType<typeof vi.fn> },
	cookies: Record<string, string> = {},
	query: Record<string, string> = {}
): PageContext {
	return {
		req: { method: 'GET', cookies },
		resolvedUrl: pool ? `/yields/pool/${pool}` : '/yields/pool/',
		params: pool ? { pool } : {},
		query,
		res
	} as unknown as PageContext
}

const {
	fetchPoolDetailMock,
	fetchPoolDetailHistoryMock,
	fetchBorrowMarketDetailMock,
	fetchBorrowMarketDetailHistoryMock,
	getYieldsMetaMock,
	hasVerifiedEarnPoolMock,
	hasVaultRiskMock,
	validateSubscriptionMock,
	fetchVerifiedPoolDetailMock,
	fetchVerifiedPoolHistoryMock
} = vi.hoisted(() => ({
	fetchPoolDetailMock: vi.fn(),
	fetchPoolDetailHistoryMock: vi.fn(),
	fetchBorrowMarketDetailMock: vi.fn(),
	fetchBorrowMarketDetailHistoryMock: vi.fn(),
	getYieldsMetaMock: vi.fn(),
	hasVerifiedEarnPoolMock: vi.fn(),
	hasVaultRiskMock: vi.fn(),
	validateSubscriptionMock: vi.fn(),
	fetchVerifiedPoolDetailMock: vi.fn(),
	fetchVerifiedPoolHistoryMock: vi.fn()
}))

vi.mock('~/utils/apiAuth', () => ({ validateSubscription: validateSubscriptionMock }))

class ApiError extends Error {
	status: number
	url: string
	constructor(status: number, url: string) {
		super(`yields ${status}: ${url}`)
		this.name = 'ApiError'
		this.status = status
		this.url = url
	}
}

vi.mock('~/containers/Yields/poolDetail/fetch', () => ({
	fetchPoolDetail: fetchPoolDetailMock,
	fetchPoolDetailHistory: fetchPoolDetailHistoryMock,
	fetchReportedPoolDetail: fetchPoolDetailMock,
	fetchReportedPoolHistory: fetchPoolDetailHistoryMock,
	fetchVerifiedPoolDetail: fetchVerifiedPoolDetailMock,
	fetchVerifiedPoolHistory: fetchVerifiedPoolHistoryMock,
	mergePoolVerifiedHistory: (history: Array<Record<string, unknown>>, verified: Array<unknown> | null) =>
		verified?.length ? history.map((row) => ({ ...row, verified: verified[0] })) : history,
	fetchBorrowMarketDetail: fetchBorrowMarketDetailMock,
	fetchBorrowMarketDetailHistory: fetchBorrowMarketDetailHistoryMock,
	isNotFoundError: (error: unknown) => error instanceof ApiError && error.status === 404
}))

vi.mock('~/containers/Yields/server/dataset.server', () => ({
	acquireYieldsSnapshot: vi.fn(() => Promise.resolve({ readJson: vi.fn() }))
}))

vi.mock('~/containers/Yields/data/snapshot', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/containers/Yields/data/snapshot')>()),
	hasVerifiedEarnPool: hasVerifiedEarnPoolMock,
	readYieldsMeta: getYieldsMetaMock,
	readYieldsExploits: () => Promise.resolve([])
}))

vi.mock('~/containers/Yields/data/server/raiseValuations', () => ({
	getReferralUrls: () => Promise.resolve(new Map<string, string>())
}))

vi.mock('~/containers/Yields/VaultRisk/loader', () => ({
	hasVaultRisk: hasVaultRiskMock
}))

const META = {
	chains: [{ slug: 'ethereum', name: 'Ethereum', is_evm: true }],
	protocols: [
		{
			slug: 'lido',
			name: 'Lido',
			category: 'Liquid Staking',
			has_audit: true,
			potential_airdrop: false
		}
	],
	categories: [{ slug: 'liquid-staking', name: 'Liquid Staking' }],
	tokens: { families: [], assets: [] }
}

function detailFixture(): PoolDetail {
	return {
		id: '79e042b5-e55d-4a4e-b0b0-6661a570470b',
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
		stability_30d: {
			base: 0.9,
			base_reward: 0.9,
			base_intrinsic: 0.9,
			base_reward_intrinsic: 0.9
		},
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
		attributes: {
			stablecoin_only: false,
			single_asset_exposure: true,
			impermanent_loss_risk: false
		},
		available_history: { supply: false, borrow: false }
	}
}

// `/v2/borrow/markets/:id` detail shape for a borrow-only market (no earn row).
function marketFixture(): BorrowMarketDetail {
	const zero = { base: 0, reward: null, total: 0 }
	const cost = { base: 4.3, reward: null, total: 4.3 }
	return {
		id: '4cb40f0a-65df-431b-be1a-da0ab66a04a9',
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

function marketHistoryFixture() {
	const cost = { base: 4.3, reward: null, total: 4.3 }
	return [
		{
			date: '2026-06-01',
			total_borrow_usd: 5,
			available_borrow_usd: 100_480,
			borrow_cost_apy: { avg_1d: cost, avg_7d: cost, avg_30d: cost },
			intrinsic: null
		}
	]
}

describe('YieldPoolPage', () => {
	beforeEach(() => {
		fetchPoolDetailMock.mockReset()
		fetchPoolDetailHistoryMock.mockReset()
		fetchBorrowMarketDetailMock.mockReset()
		fetchBorrowMarketDetailHistoryMock.mockReset()
		getYieldsMetaMock.mockReset()
		getYieldsMetaMock.mockResolvedValue(META)
		hasVerifiedEarnPoolMock.mockReset()
		hasVerifiedEarnPoolMock.mockResolvedValue(false)
		hasVaultRiskMock.mockReset()
		hasVaultRiskMock.mockResolvedValue(false)
		validateSubscriptionMock.mockReset()
		fetchVerifiedPoolDetailMock.mockReset()
		fetchVerifiedPoolDetailMock.mockResolvedValue(null)
		fetchVerifiedPoolHistoryMock.mockReset()
		fetchVerifiedPoolHistoryMock.mockResolvedValue(null)
	})

	test('returns not found when no pool id is provided', async () => {
		const res = { setHeader: vi.fn() }

		const result = await getServerSideProps(pageContext(undefined, res))

		expect(result).toEqual({ notFound: true })
		expect(fetchPoolDetailMock).not.toHaveBeenCalled()
		expect(hasVaultRiskMock).not.toHaveBeenCalled()
		expect(res.setHeader).not.toHaveBeenCalled()
	})

	test('returns not found when both the earn and borrow-market detail endpoints 404', async () => {
		const poolId = '79e042b5-e55d-4a4e-b0b0-6661a570470b'
		const res = { setHeader: vi.fn() }
		fetchPoolDetailMock.mockRejectedValue(new ApiError(404, `/v2/earn/${poolId}`))
		fetchBorrowMarketDetailMock.mockRejectedValue(new ApiError(404, `/v2/borrow/markets/${poolId}`))

		const result = await getServerSideProps(pageContext(poolId, res))

		expect(result).toEqual({ notFound: true })
		expect(fetchPoolDetailMock).toHaveBeenCalledWith(poolId)
		expect(fetchBorrowMarketDetailMock).toHaveBeenCalledWith(poolId)
		expect(hasVaultRiskMock).toHaveBeenCalledWith(poolId)
		expect(getYieldsMetaMock).not.toHaveBeenCalled()
		expect(res.setHeader).not.toHaveBeenCalled()
	})

	test('propagates an invalid-id 400 instead of classifying it as not found', async () => {
		const poolId = 'invalid-id'
		const error = new ApiError(400, `/v2/earn/${poolId}`)
		fetchPoolDetailMock.mockRejectedValue(error)

		await expect(getServerSideProps(pageContext(poolId, { setHeader: vi.fn() }))).rejects.toBe(error)
		expect(fetchBorrowMarketDetailMock).not.toHaveBeenCalled()
	})

	test('falls back to the borrow-market detail for a borrow-only market', async () => {
		const poolId = '4cb40f0a-65df-431b-be1a-da0ab66a04a9'
		const res = { setHeader: vi.fn() }
		fetchPoolDetailMock.mockRejectedValue(new ApiError(404, `/v2/earn/${poolId}`))
		fetchBorrowMarketDetailMock.mockResolvedValue(marketFixture())
		fetchBorrowMarketDetailHistoryMock.mockResolvedValue(marketHistoryFixture())

		const result = await getServerSideProps(pageContext(poolId, res))

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('Expected props')
		const props = await result.props
		expect(props.mode).toBe('borrow')
		expect(props.poolId).toBe(poolId)
		expect(props.symbol).toBe('weETH / GHO')
		// Entity facts joined from meta the same way earn pools are.
		expect(props.protocol).toEqual({
			slug: 'lido',
			name: 'Lido',
			category: 'Liquid Staking',
			has_audit: true
		})
		expect(props.chain).toEqual({ slug: 'ethereum', name: 'Ethereum' })
		if (!props.supply || !props.borrow) throw new Error('Expected borrow market views')
		expect(props.supply.apyLabel).toBe('Supply APY')
		expect(props.supply.metrics[0]).toEqual({
			label: 'Total supplied',
			value: 5
		})
		expect(props.borrow.apyLabel).toBe('Borrow APY')
		expect(props.borrow.apy.base).toBe(4.3)
		expect(props.borrow.metrics).toEqual([
			{ label: 'Total borrowed', value: 5 },
			{ label: 'Available', value: 100_480 },
			{ label: 'Max LTV', value: 0.75, format: 'ltv' }
		])
		// Borrow-only markets have no supply history or stability, but do carry a borrow chart.
		expect(props.supplyChart).toBeNull()
		expect(props.borrowChart).not.toBeNull()
		expect(props.stability).toBeNull()
		expect(props.holders).toBeNull()
		expect(fetchBorrowMarketDetailMock).toHaveBeenCalledWith(poolId)
		expect(hasVaultRiskMock).toHaveBeenCalledWith(poolId)
		expect(fetchPoolDetailHistoryMock).not.toHaveBeenCalled()
		expect(fetchBorrowMarketDetailHistoryMock).toHaveBeenCalled()
		expect(res.setHeader).toHaveBeenCalled()
	})

	test('builds detail props for a valid pool, joining slug/category/audit from meta', async () => {
		const poolId = '79e042b5-e55d-4a4e-b0b0-6661a570470b'
		const res = { setHeader: vi.fn() }
		fetchPoolDetailMock.mockResolvedValue(detailFixture())

		const result = await getServerSideProps(pageContext(poolId, res))

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('Expected props')
		const props = await result.props
		expect(props.poolId).toBe(poolId)
		expect(props.symbol).toBe('stETH')
		expect(props.protocol).toEqual({
			slug: 'lido',
			name: 'Lido',
			category: 'Liquid Staking',
			has_audit: true
		})
		expect(props.chain).toEqual({ slug: 'ethereum', name: 'Ethereum' })
		if (!props.supply) throw new Error('Expected supply view')
		expect(props.supply.apy.base).toBe(2.3)
		expect(props.supply.metrics[0]?.label).toBe('TVL')
		expect(props.stability).toEqual({ score: 0.9, rating: 'stable' })
		// available_history.supply is false → no history fetch, no supply chart.
		expect(fetchPoolDetailHistoryMock).not.toHaveBeenCalled()
		expect(hasVaultRiskMock).toHaveBeenCalledWith(poolId)
		expect(props.supplyChart).toBeNull()
		expect(res.setHeader).toHaveBeenCalled()
	})

	test('fetches only the requested reported range for an unmeasured pool', async () => {
		const poolId = '79e042b5-e55d-4a4e-b0b0-6661a570470d'
		const res = { setHeader: vi.fn() }
		fetchPoolDetailMock.mockResolvedValue({
			...detailFixture(),
			id: poolId,
			available_history: { supply: true, borrow: false }
		})
		fetchPoolDetailHistoryMock.mockResolvedValue([])

		await getServerSideProps(pageContext(poolId, res, {}, { range: '30d', growthRange: '30d', liquidityRange: '30d' }))

		expect(fetchPoolDetailHistoryMock).toHaveBeenCalledOnce()
		expect(fetchPoolDetailHistoryMock).toHaveBeenCalledWith(poolId, '30d')
		expect(fetchVerifiedPoolHistoryMock).not.toHaveBeenCalled()
	})

	// The measured block only reaches the HTML for a request that proves an active subscription.
	describe('entitlement on first paint', () => {
		// The detail fetch is memoized by id, so each case gets its own pool.
		const measured = (id: string): PoolDetail => ({
			...detailFixture(),
			id,
			verified: {
				apy: { avg_1d: 2.4, avg_7d: 2.3, avg_30d: 2.2 },
				apy_as_of: '2026-09-01T00:00:00Z',
				apy_confidence: 'high',
				exit: { status: 'queued', eta_seconds: 259_200, fee_bps: 0, as_of: null },
				exit_liquidity: null,
				tvl: null
			}
		})
		const headers = (res: { setHeader: ReturnType<typeof vi.fn> }) => Object.fromEntries(res.setHeader.mock.calls)

		test('redacts and publicly caches an anonymous request', async () => {
			const poolId = 'a1a1a1a1-0000-4000-8000-000000000001'
			const res = { setHeader: vi.fn() }
			fetchPoolDetailMock.mockResolvedValue(measured(poolId))
			hasVerifiedEarnPoolMock.mockResolvedValue(true)

			const result = await getServerSideProps(pageContext(poolId, res))
			if (!('props' in result)) throw new Error('Expected props')
			const props = await result.props

			expect(props.verified).toBeNull()
			expect(props.verifiedLocked).toBe(true)
			expect(fetchVerifiedPoolDetailMock).not.toHaveBeenCalled()
			expect(validateSubscriptionMock).not.toHaveBeenCalled()
			expect(headers(res)['cache-control']).toMatch(/^public/)
			expect(headers(res)['Vary']).toBe('Cookie, Authorization')
		})

		test('renders the measured page for a subscriber and keeps it out of the shared cache', async () => {
			const poolId = 'a1a1a1a1-0000-4000-8000-000000000002'
			const res = { setHeader: vi.fn() }
			fetchPoolDetailMock.mockResolvedValue(measured(poolId))
			hasVerifiedEarnPoolMock.mockResolvedValue(true)
			validateSubscriptionMock.mockResolvedValue({ valid: true, isTrial: false })

			const result = await getServerSideProps(pageContext(poolId, res, { pb_auth_token: 'tok' }))
			if (!('props' in result)) throw new Error('Expected props')
			const props = await result.props

			expect(validateSubscriptionMock).toHaveBeenCalledWith('Bearer tok')
			expect(props.verified?.apy.avg_1d).toBe(2.4)
			expect(props.verifiedLocked).toBe(false)
			expect(fetchVerifiedPoolDetailMock).toHaveBeenCalledWith(poolId)
			expect(headers(res)['cache-control']).toBe('private, no-store')
		})

		test('fetches measured max history once and slices the requested first-paint range locally', async () => {
			const poolId = 'a1a1a1a1-0000-4000-8000-000000000005'
			const res = { setHeader: vi.fn() }
			fetchPoolDetailMock.mockResolvedValue({
				...measured(poolId),
				available_history: { supply: true, borrow: false }
			})
			fetchPoolDetailHistoryMock.mockResolvedValue([])
			hasVerifiedEarnPoolMock.mockResolvedValue(true)
			validateSubscriptionMock.mockResolvedValue({ valid: true, isTrial: false })

			await getServerSideProps(
				pageContext(poolId, res, { pb_auth_token: 'tok' }, { range: '30d', growthRange: '30d', liquidityRange: '30d' })
			)

			expect(fetchPoolDetailHistoryMock).toHaveBeenCalledOnce()
			expect(fetchPoolDetailHistoryMock).toHaveBeenCalledWith(poolId, 'max')
			expect(fetchVerifiedPoolHistoryMock).toHaveBeenCalledOnce()
			expect(fetchVerifiedPoolHistoryMock).toHaveBeenCalledWith(poolId, 'max')
		})

		test.each(['network', 'http'])('keeps unavailable entitlement neutral (%s)', async (failure) => {
			const poolId = 'a1a1a1a1-0000-4000-8000-000000000004'
			const res = { setHeader: vi.fn() }
			fetchPoolDetailMock.mockResolvedValue(measured(poolId))
			hasVerifiedEarnPoolMock.mockResolvedValue(true)
			if (failure === 'network') validateSubscriptionMock.mockRejectedValue(new Error('auth service unavailable'))
			else
				validateSubscriptionMock.mockResolvedValue({
					valid: false,
					status: 503,
					error: 'Subscription service unavailable'
				})

			const result = await getServerSideProps(pageContext(poolId, res, { pb_auth_token: 'tok' }))
			if (!('props' in result)) throw new Error('Expected props')
			const props = await result.props

			expect(props.verified).toBeNull()
			expect(props.verifiedLocked).toBeNull()
			expect(headers(res)['cache-control']).toBe('private, no-store')
		})

		test('redacts a signed-in request without an active subscription, still privately', async () => {
			const poolId = 'a1a1a1a1-0000-4000-8000-000000000003'
			const res = { setHeader: vi.fn() }
			fetchPoolDetailMock.mockResolvedValue(measured(poolId))
			hasVerifiedEarnPoolMock.mockResolvedValue(true)
			validateSubscriptionMock.mockResolvedValue({ valid: false, status: 403, error: 'Active subscription required' })

			const result = await getServerSideProps(pageContext(poolId, res, { pb_auth_token: 'tok' }))
			if (!('props' in result)) throw new Error('Expected props')
			const props = await result.props

			expect(props.verified).toBeNull()
			expect(props.verifiedLocked).toBe(true)
			expect(headers(res)['cache-control']).toBe('private, no-store')
		})
	})
})
