import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getServerSideProps } from '~/pages/yields/pool/[pool]'

type PageContext = Parameters<typeof getServerSideProps>[0]

function pageContext(pool: string | undefined, res: { setHeader: ReturnType<typeof vi.fn> }): PageContext {
	return {
		req: { method: 'GET' },
		resolvedUrl: pool ? `/yields/pool/${pool}` : '/yields/pool/',
		params: pool ? { pool } : {},
		query: {},
		res
	} as unknown as PageContext
}

const {
	fetchPoolDetailMock,
	fetchPoolDetailHistoryMock,
	fetchBorrowMarketDetailMock,
	fetchBorrowMarketDetailHistoryMock,
	getYieldsMetaMock,
	hasVaultRiskMock
} = vi.hoisted(() => ({
	fetchPoolDetailMock: vi.fn(),
	fetchPoolDetailHistoryMock: vi.fn(),
	fetchBorrowMarketDetailMock: vi.fn(),
	fetchBorrowMarketDetailHistoryMock: vi.fn(),
	getYieldsMetaMock: vi.fn(),
	hasVaultRiskMock: vi.fn()
}))

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
	fetchBorrowMarketDetail: fetchBorrowMarketDetailMock,
	fetchBorrowMarketDetailHistory: fetchBorrowMarketDetailHistoryMock,
	isNotFoundError: (error: unknown) => error instanceof ApiError && (error.status === 400 || error.status === 404)
}))

vi.mock('~/containers/Yields/server/dataset.server', () => ({
	acquireYieldsSnapshot: vi.fn(() => Promise.resolve({ readJson: vi.fn() }))
}))

vi.mock('~/containers/Yields/data/snapshot', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/containers/Yields/data/snapshot')>()),
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
	protocols: [{ slug: 'lido', name: 'Lido', category: 'Liquid Staking', has_audit: true, has_token: true }],
	categories: [{ slug: 'liquid-staking', name: 'Liquid Staking' }],
	tokens: { families: [], assets: [] }
}

function detailFixture() {
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
		stability_30d: { base: 0.9, base_reward: 0.9, base_intrinsic: 0.9, base_reward_intrinsic: 0.9 },
		holders: null,
		price_per_share: 1,
		volume_1d_usd: null,
		attributes: {
			stablecoin_only: false,
			single_asset_exposure: true,
			impermanent_loss_risk: false,
			has_meme_token: false
		},
		available_history: { supply: false, borrow: false }
	}
}

// `/v2/borrow/markets/:id` detail shape for a borrow-only market (no earn row).
function marketFixture() {
	const zero = { base: 0, reward: null, total: 0 }
	const cost = { base: 4.3, reward: null, total: 4.3 }
	return {
		id: '4cb40f0a-65df-431b-be1a-da0ab66a04a9',
		pool_key: 'plasma_0x99',
		pool_token: { address: '0x991416', symbol: null, name: null },
		display: { label: 'weETH / GHO', detail: null },
		market_type: 'isolated',
		url: 'https://fluid.io/vaults/9745/24',
		protocol: 'Lido',
		chain: 'Ethereum',
		collateral_token: { address: '0xa3', symbol: 'weETH', decimals: 18 },
		borrow_token: { address: '0xb7', symbol: 'GHO', decimals: 18 },
		reward_tokens: [],
		loan_to_value: 0.75,
		total_supply_usd: 5,
		total_borrow_usd: 5,
		available_borrow_usd: 100480,
		borrow_capacity_filled: 0.0000497587,
		supply_apy: { current: zero, avg_7d: zero, avg_30d: zero },
		borrow_cost_apy: { current: cost, avg_7d: cost, avg_30d: cost },
		intrinsic: { supply: null, borrow: null },
		attributes: { has_meme_token: false },
		available_history: { supply: false, borrow: true }
	}
}

function marketHistoryFixture() {
	const cost = { base: 4.3, reward: null, total: 4.3 }
	return [
		{
			date: '2026-06-01',
			total_borrow_usd: 5,
			available_borrow_usd: 100480,
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
		hasVaultRiskMock.mockReset()
		hasVaultRiskMock.mockResolvedValue(false)
	})

	it('returns not found when no pool id is provided', async () => {
		const res = { setHeader: vi.fn() }

		const result = await getServerSideProps(pageContext(undefined, res))

		expect(result).toEqual({ notFound: true })
		expect(fetchPoolDetailMock).not.toHaveBeenCalled()
		expect(hasVaultRiskMock).not.toHaveBeenCalled()
		expect(res.setHeader).not.toHaveBeenCalled()
	})

	it('returns not found when both the earn and borrow-market detail endpoints 404', async () => {
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

	it('falls back to the borrow-market detail for a borrow-only market', async () => {
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
		expect(props.protocol).toEqual({ slug: 'lido', name: 'Lido', category: 'Liquid Staking', has_audit: true })
		expect(props.chain).toEqual({ slug: 'ethereum', name: 'Ethereum' })
		expect(props.supply.apyLabel).toBe('Supply APY')
		expect(props.supply.metrics[0]).toEqual({ label: 'Total supplied', value: 5 })
		expect(props.borrow.apyLabel).toBe('Borrow APY')
		expect(props.borrow.apy.base).toBe(4.3)
		expect(props.borrow.metrics).toEqual([
			{ label: 'Total borrowed', value: 5 },
			{ label: 'Available', value: 100480 },
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

	it('builds detail props for a valid pool, joining slug/category/audit from meta', async () => {
		const poolId = '79e042b5-e55d-4a4e-b0b0-6661a570470b'
		const res = { setHeader: vi.fn() }
		fetchPoolDetailMock.mockResolvedValue(detailFixture())

		const result = await getServerSideProps(pageContext(poolId, res))

		expect('props' in result).toBe(true)
		if (!('props' in result)) throw new Error('Expected props')
		const props = await result.props
		expect(props.poolId).toBe(poolId)
		expect(props.symbol).toBe('stETH')
		expect(props.protocol).toEqual({ slug: 'lido', name: 'Lido', category: 'Liquid Staking', has_audit: true })
		expect(props.chain).toEqual({ slug: 'ethereum', name: 'Ethereum' })
		expect(props.supply.apy.base).toBe(2.3)
		expect(props.supply.metrics[0].label).toBe('TVL')
		expect(props.stability).toEqual({ score: 0.9, rating: 'stable' })
		// available_history.supply is false → no history fetch, no supply chart.
		expect(fetchPoolDetailHistoryMock).not.toHaveBeenCalled()
		expect(hasVaultRiskMock).toHaveBeenCalledWith(poolId)
		expect(props.supplyChart).toBeNull()
		expect(res.setHeader).toHaveBeenCalled()
	})
})
