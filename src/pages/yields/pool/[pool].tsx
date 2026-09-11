import type { GetServerSideProps } from 'next'
import { getAuthTokenFromRequest } from '~/containers/ProDashboard/server/auth'
import { resolveApy, resolveVariant, stabilityRatingFromScore } from '~/containers/Yields/data/apy'
import { getReferralUrls } from '~/containers/Yields/data/server/raiseValuations'
import {
	hasVerifiedEarnPool,
	readYieldsExploits,
	readYieldsMeta,
	type YieldsSnapshot
} from '~/containers/Yields/data/snapshot'
import type { ApyComponent } from '~/containers/Yields/data/types'
import { lockPoolDetail, lockPoolHistory } from '~/containers/Yields/data/verifiedGate'
import {
	fetchBorrowMarketDetail,
	fetchBorrowMarketDetailHistory,
	isNotFoundError
} from '~/containers/Yields/poolDetail/fetch'
import { fetchPoolDetailCached, fetchPoolHistoryCached } from '~/containers/Yields/poolDetail/fetch.server'
import { buildBorrowChart, buildSupplyChart } from '~/containers/Yields/poolDetail/poolCharts'
import { PoolDetailView, type PoolDetailViewProps, type PoolSide } from '~/containers/Yields/poolDetail/PoolDetailView'
import {
	getPoolHistoryRange,
	getPoolRange,
	getPoolRangeQueryKey,
	slicePoolHistory,
	widestPoolRange
} from '~/containers/Yields/poolDetail/queryState'
import type { BorrowMarketDetail, PoolHistoryRange } from '~/containers/Yields/poolDetail/types'
import { buildPoolVerifiedProps } from '~/containers/Yields/poolDetail/verifiedProps'
import { resolveSubscription } from '~/containers/Yields/server/requestSubscription'
import Layout from '~/layout'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'

// Categories where the headline dollar figure is supplied liquidity, not pooled TVL —
// so the KPI reads "Total supplied" instead of "TVL". Keyed by the meta category slug.
const SUPPLY_HEADER_CATEGORIES = new Set(['lending', 'cdp', 'uncollateralized-lending'])

// The detail page shows the full supply APY composition (base + reward + intrinsic);
// the new API returns every variant and the client resolves the view.
const DETAIL_APY_COMPONENTS: Array<ApyComponent> = ['base', 'reward', 'intrinsic']
// The borrow leg carries no intrinsic yield (matches the old page's base+reward fetch).
const BORROW_APY_COMPONENTS: Array<ApyComponent> = ['base', 'reward']

async function optionalResource<T>(load: () => Promise<T>): Promise<T | null> {
	try {
		return await load()
	} catch (error) {
		if (isNotFoundError(error)) return null
		throw error
	}
}

// Borrow-only markets (676 of ~1594) have no `/v2/earn/:id` row, so the earn detail
// 404s and we render from the borrow-markets detail endpoint instead. The market row
// carries both supply and borrow APY windows, sizing, LTV, and borrow history — mapped
// onto the same PoolDetailView (borrow chart is the only history available).

// Distinct constituent-token symbols for the Assets row, from the structured
// underlying_tokens (falling back to the pool token itself).
function assetSymbols(detail: {
	underlying_tokens?: Array<{ symbol?: string | null }> | null
	reference_asset_symbol?: string | null
}): Array<string> {
	// The underlying constituents, original casing preserved; reference symbol as the
	// single-entry fallback when the decomposition is absent.
	const underlying = (detail.underlying_tokens ?? []).map((t) => t.symbol).filter((x): x is string => !!x)
	if (underlying.length > 0) return [...new Set(underlying)]
	return detail.reference_asset_symbol ? [detail.reference_asset_symbol] : []
}

// Scale for the verified block's raw base-unit amounts. `verified.denomination` is authoritative;
// a handful of measured pools carry none, and those render in USD only rather than in a unit we
// would be guessing at. The symbol is cosmetic, so it still comes from the underlying token when
// there is exactly one to name.
function rewardTokenSymbols(tokens: Array<{ symbol?: string | null }>): Array<string> {
	return tokens.flatMap(({ symbol }) => (symbol ? [symbol] : []))
}

async function buildBorrowOnlyProps(
	snapshot: YieldsSnapshot,
	id: string,
	market: BorrowMarketDetail,
	initialRange: PoolHistoryRange
): Promise<Omit<PoolDetailViewProps, 'hasRisk' | 'exploited'>> {
	const available = market.available_history ?? { supply: false, borrow: true }
	const metaPromise = readYieldsMeta(snapshot)
	const [borrowHistory, meta, referralUrls] = await Promise.all([
		available.borrow ? optionalResource(() => fetchBorrowMarketDetailHistory(id, initialRange)) : Promise.resolve(null),
		metaPromise,
		getReferralUrls(snapshot)
	])
	const borrowChart = borrowHistory?.length ? buildBorrowChart(borrowHistory) : null

	// Rows carry plain protocol/chain NAME strings; join slug / category / audit from /v2/meta.
	const protocolMeta = meta.protocols.find((p) => p.name === market.protocol) ?? null
	const chainMeta = meta.chains.find((c) => c.name === market.chain) ?? null

	const rewardTokens = rewardTokenSymbols(market.reward_tokens)

	// Supply leg: base + reward + intrinsic (matches the earn supply composition).
	const supplyParts = resolveApy(market.supply_apy, market.intrinsic?.supply, 'current', DETAIL_APY_COMPONENTS)
	const supply: PoolSide = {
		apyLabel: 'Supply APY',
		apy: {
			total: supplyParts.total,
			base: supplyParts.base,
			reward: supplyParts.reward,
			intrinsic: supplyParts.intrinsic,
			rewardTokens,
			intrinsicSource: market.intrinsic?.supply?.source_pool?.symbol ?? null
		},
		metrics: [{ label: 'Total supplied', value: market.total_supply_usd ?? null }]
	}

	// Borrow leg carries no intrinsic yield (matches the dual-pool borrow side).
	const borrowParts = resolveApy(market.borrow_cost_apy, null, 'current', BORROW_APY_COMPONENTS)
	const borrow: PoolSide = {
		apyLabel: 'Borrow APY',
		apy: {
			total: borrowParts.total,
			base: borrowParts.base,
			reward: borrowParts.reward,
			intrinsic: null,
			rewardTokens,
			intrinsicSource: null
		},
		metrics: [
			{ label: 'Total borrowed', value: market.total_borrow_usd ?? null },
			{ label: 'Available', value: market.available_borrow_usd ?? null },
			{ label: 'Max LTV', value: market.loan_to_value ?? null, format: 'ltv' }
		]
	}

	return {
		poolId: id,
		mode: 'borrow',
		initialRange,
		symbol: market.display.label ?? '—',
		name: market.display.detail ?? '',
		protocol: {
			slug: protocolMeta?.slug ?? '',
			name: market.protocol,
			category: protocolMeta?.category ?? null,
			has_audit: protocolMeta?.has_audit ?? null
		},
		chain: {
			slug: chainMeta?.slug ?? '',
			name: market.chain
		},
		supply,
		borrow,
		supplyChart: null,
		borrowChart,
		// Borrow-only markets have no earn row, so no simulated redemptions are measured for them.
		growthChart: null,
		liquidityChart: null,
		liquidityDecimals: null,
		exitReliability: null,
		verified: null,
		apy: null,
		verifiedWindows: [],
		holders: null,
		stability: null,
		details: {
			poolTokenAddress: market.pool_token?.address ?? null,
			url: (protocolMeta?.slug ? referralUrls.get(protocolMeta.slug) : undefined) ?? market.url ?? null,
			protocolName: market.protocol,
			assets: []
		}
	}
}

// Anonymous requests are publicly cached and always redacted. A request carrying the session cookie
// is rendered per user, so a subscriber gets the measured page on first paint, and the response
// never enters the shared cache. Same pattern as the Pro dashboard pages.
const POOL_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600'
const PRIVATE_POOL_CACHE_CONTROL = 'private, no-store'

const getServerSidePropsHandler: GetServerSideProps<PoolDetailViewProps> = async ({ params, query, req, res }) => {
	const poolParam = params?.pool
	const id = typeof poolParam === 'string' ? poolParam : Array.isArray(poolParam) ? poolParam[0] : null
	if (!id) return { notFound: true }

	const token = getAuthTokenFromRequest(req)
	const setCacheHeaders = () => {
		res.setHeader('Vary', 'Cookie, Authorization')
		res.setHeader('cache-control', token ? PRIVATE_POOL_CACHE_CONTROL : POOL_CACHE_CONTROL)
	}

	// Every chart keeps its own range in the URL, defaulting to max, so deep links/refresh first-paint
	// at the right windows. The supply history feeds the APY, growth and deposits panels, so it is
	// fetched once at the widest of their three ranges and each slices locally; borrow history is its
	// own fetch. The client fetches wider ranges on demand.
	const initialRange = widestPoolRange([
		getPoolHistoryRange(query[getPoolRangeQueryKey('supply')]),
		getPoolHistoryRange(query[getPoolRangeQueryKey('growth')]),
		getPoolHistoryRange(query[getPoolRangeQueryKey('liquidity')])
	])
	const initialBorrowRange = getPoolRange(query, 'borrow')
	const { acquireYieldsSnapshot } = await import('~/containers/Yields/server/dataset.server')
	const snapshot = await acquireYieldsSnapshot('blocking')

	// The risk-entry check only needs the pool id, so it runs alongside the pool data
	// (hasVaultRisk never throws — it resolves false on any failure).
	const { hasVaultRisk } = await import('~/containers/Yields/VaultRisk/loader')
	const [reportedPool, hasRisk, exploits, subscription, measuredPool] = await Promise.all([
		optionalResource(() => fetchPoolDetailCached(id)),
		hasVaultRisk(id),
		readYieldsExploits(snapshot),
		resolveSubscription(token),
		hasVerifiedEarnPool(snapshot, id)
	])
	const subscribed = subscription === true
	// The public detail is useful to every reader. Only a measured subscriber needs the separate
	// verified detail (the reported half is already warm in the cache), avoiding a 404 for almost
	// every pool and avoiding any measurement fetch for a public page.
	const rawPool =
		reportedPool && subscribed && measuredPool
			? ((await optionalResource(() => fetchPoolDetailCached(id, true))) ?? reportedPool)
			: reportedPool
	// Redacted at the one point the measurement enters the page, unless the reader is a subscriber.
	const pool = rawPool && !subscribed ? lockPoolDetail(rawPool, measuredPool) : rawPool
	const verifiedLocked = pool?.verified_locked === true
	const exploited = exploits.includes(id)
	if (!pool) {
		// Borrow-only market: no earn row, fall back to the borrow-markets detail endpoint.
		const market = await optionalResource(() => fetchBorrowMarketDetail(id))
		if (!market) return { notFound: true }
		setCacheHeaders()
		return { props: { ...(await buildBorrowOnlyProps(snapshot, id, market, initialBorrowRange)), hasRisk, exploited } }
	}

	// `available_history` gates the history fetch (fallback: assume supply history exists).
	// Pools that are also borrow markets carry borrow history — fetch it so the page can
	// render the borrow APY chart alongside the supply one, as the old page did.
	const available = pool.available_history ?? { supply: true, borrow: false }
	const metaPromise = readYieldsMeta(snapshot)
	const includeVerifiedHistory = subscribed && measuredPool && pool.verified != null
	const historyFetchRange = includeVerifiedHistory ? 'max' : initialRange
	const [fetchedHistory, borrowHistory, meta, borrowMarket, referralUrls] = await Promise.all([
		available.supply
			? optionalResource(() => fetchPoolHistoryCached(id, historyFetchRange, includeVerifiedHistory))
			: Promise.resolve(null),
		available.borrow
			? optionalResource(() => fetchBorrowMarketDetailHistory(id, initialBorrowRange))
			: Promise.resolve(null),
		metaPromise,
		available.borrow ? optionalResource(() => fetchBorrowMarketDetail(id)) : Promise.resolve(null),
		getReferralUrls(snapshot)
	])
	// A measured subscriber needs max for reliability; the visible range is a local slice of that
	// one response. Everyone else fetches only the reported range they can actually render.
	const rawHistory = fetchedHistory ? slicePoolHistory(fetchedHistory, initialRange) : null
	const rawMaxHistory = includeVerifiedHistory ? fetchedHistory : null

	const history = rawHistory && !subscribed ? lockPoolHistory(rawHistory) : rawHistory
	const maxHistory = rawMaxHistory && !subscribed ? lockPoolHistory(rawMaxHistory) : rawMaxHistory

	// Rows carry plain protocol/chain NAME strings; join slug / category / audit from /v2/meta.
	const protocolMeta = meta.protocols.find((p) => p.name === pool.protocol) ?? null
	const chainMeta = meta.chains.find((c) => c.name === pool.chain) ?? null
	const categorySlugByName = new Map(meta.categories.map((c) => [c.name, c.slug]))
	const categorySlug = protocolMeta?.category ? (categorySlugByName.get(protocolMeta.category) ?? null) : null
	const usesSupplyLabel = categorySlug ? SUPPLY_HEADER_CATEGORIES.has(categorySlug) : false

	const supplyChart = history?.length ? buildSupplyChart(history, usesSupplyLabel ? 'Total supplied' : 'TVL') : null
	const borrowChart = borrowHistory?.length ? buildBorrowChart(borrowHistory) : null
	// Empty on a redacted page; a subscriber's request carries the measured models from here.
	const fullHistory = initialRange === 'max' ? history : maxHistory
	const sourceId = pool.verified && pool.intrinsic ? pool.intrinsic.source_pool.id : null
	const sourceVerified = sourceId
		? ((await optionalResource(() => fetchPoolDetailCached(sourceId, true)))?.verified ?? null)
		: null
	const { verified, apy, verifiedWindows, growthChart, liquidityChart, liquidityDecimals, exitReliability } =
		buildPoolVerifiedProps({
			pool,
			history,
			fullHistory,
			sourceVerified
		})

	// When this pool is also a borrow market, surface the borrow side (APY + borrowed /
	// available) from the borrow-markets dataset row (same id), resolved at current
	// base+reward — the borrow leg has no intrinsic yield.
	let borrow: PoolSide | null = null
	if (available.borrow) {
		const market = borrowMarket
		if (market) {
			const borrowParts = resolveApy(market.borrow_cost_apy, null, 'current', BORROW_APY_COMPONENTS)
			borrow = {
				apyLabel: 'Borrow APY',
				apy: {
					total: borrowParts.total,
					base: borrowParts.base,
					reward: borrowParts.reward,
					intrinsic: null,
					rewardTokens: rewardTokenSymbols(market.reward_tokens),
					intrinsicSource: null
				},
				metrics: [
					{ label: 'Borrowed', value: market.total_borrow_usd ?? null },
					{ label: 'Available', value: market.available_borrow_usd ?? null }
				]
			}
		}
	}

	const parts = resolveApy(pool.apy, pool.intrinsic, 'current', DETAIL_APY_COMPONENTS)
	const supply: PoolSide = {
		apyLabel: 'Supply APY',
		apy: {
			total: parts.total,
			base: parts.base,
			reward: parts.reward,
			intrinsic: parts.intrinsic,
			rewardTokens: rewardTokenSymbols(pool.reward_tokens),
			intrinsicSource: pool.intrinsic?.source_pool?.symbol ?? null
		},
		metrics: [{ label: usesSupplyLabel ? 'Total supplied' : 'TVL', value: pool.tvl_usd ?? null }]
	}

	const stabilityScore = resolveVariant(pool.stability_30d, DETAIL_APY_COMPONENTS)

	setCacheHeaders()

	return {
		props: {
			hasRisk,
			verifiedLocked: verifiedLocked && subscription === null ? null : verifiedLocked,
			exploited,
			poolId: id,
			mode: 'pool',
			initialRange,
			initialBorrowRange,
			symbol: pool.display.label ?? '—',
			name: pool.display.detail ?? '',
			protocol: {
				slug: protocolMeta?.slug ?? '',
				name: pool.protocol,
				category: protocolMeta?.category ?? null,
				has_audit: protocolMeta?.has_audit ?? null
			},
			chain: {
				slug: chainMeta?.slug ?? '',
				name: pool.chain
			},
			supply,
			borrow,
			supplyChart,
			borrowChart,
			growthChart,
			liquidityChart,
			liquidityDecimals,
			exitReliability,
			verified,
			apy,
			verifiedWindows,
			holders: pool.holders ?? null,
			stability:
				stabilityScore != null ? { score: stabilityScore, rating: stabilityRatingFromScore(stabilityScore) } : null,
			details: {
				poolTokenAddress: pool.pool_token?.address ?? null,
				url: (protocolMeta?.slug ? referralUrls.get(protocolMeta.slug) : undefined) ?? pool.url ?? null,
				protocolName: pool.protocol,
				assets: assetSymbols(pool)
			}
		}
	}
}

export const getServerSideProps = withServerSidePropsTelemetry('yields/pool/[pool]', getServerSidePropsHandler)

export default function YieldsPoolDetailPage(props: PoolDetailViewProps) {
	return (
		<Layout
			title={`${props.symbol} - ${props.protocol.name} - DefiLlama`}
			description={`APY history, holder concentration and details for ${props.symbol} on ${props.protocol.name}.`}
			canonicalUrl={props.poolId ? `/yields/pool/${props.poolId}` : null}
		>
			<PoolDetailView {...props} />
		</Layout>
	)
}
