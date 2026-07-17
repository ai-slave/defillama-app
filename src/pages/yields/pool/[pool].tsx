import type { GetServerSideProps } from 'next'
import { resolveApy } from '~/containers/Yields/data/apy'
import { getReferralUrls } from '~/containers/Yields/data/server/raiseValuations'
import { readYieldsMeta, type YieldsSnapshot } from '~/containers/Yields/data/snapshot'
import type { ApyComponent } from '~/containers/Yields/data/types'
import {
	fetchBorrowMarketDetail,
	fetchBorrowMarketDetailHistory,
	fetchPoolDetail,
	fetchPoolDetailHistory,
	isNotFoundError
} from '~/containers/Yields/poolDetail/fetch'
import { buildBorrowChart, buildSupplyChart } from '~/containers/Yields/poolDetail/poolCharts'
import { PoolDetailView, type PoolDetailViewProps, type PoolSide } from '~/containers/Yields/poolDetail/PoolDetailView'
import { getPoolHistoryRange } from '~/containers/Yields/poolDetail/queryState'
import { getPoolStability } from '~/containers/Yields/poolDetail/stability'
import type { BorrowMarketDetail, PoolHistoryRange } from '~/containers/Yields/poolDetail/types'
import Layout from '~/layout'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'

// Categories where the headline dollar figure is supplied liquidity, not pooled TVL —
// so the KPI reads "Total supplied" instead of "TVL". Keyed by the meta category slug.
const SUPPLY_HEADER_CATEGORIES = new Set(['lending', 'cdp', 'uncollateralized-lending'])

// The detail page shows the full supply APY composition (base + reward + intrinsic);
// the new API returns every variant and the client resolves the view.
const DETAIL_APY_COMPONENTS: ApyComponent[] = ['base', 'reward', 'intrinsic']
// The borrow leg carries no intrinsic yield (matches the old page's base+reward fetch).
const BORROW_APY_COMPONENTS: ApyComponent[] = ['base', 'reward']

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
}): string[] {
	// The underlying constituents, original casing preserved; reference symbol as the
	// single-entry fallback when the decomposition is absent.
	const underlying = (detail.underlying_tokens ?? []).map((t) => t.symbol).filter((x): x is string => !!x)
	if (underlying.length) return [...new Set(underlying)]
	return detail.reference_asset_symbol ? [detail.reference_asset_symbol] : []
}

function rewardTokenSymbols(tokens: Array<{ symbol?: string | null }>): string[] {
	return tokens.flatMap(({ symbol }) => (symbol ? [symbol] : []))
}

async function buildBorrowOnlyProps(
	snapshot: YieldsSnapshot,
	id: string,
	market: BorrowMarketDetail,
	initialRange: PoolHistoryRange
): Promise<Omit<PoolDetailViewProps, 'hasRisk'>> {
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
		symbol: market.display?.label ?? '—',
		name: market.display?.detail ?? '',
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
		holders: market.holders ?? null,
		stabilityAvailable: false,
		details: {
			poolTokenAddress: market.pool_token?.address ?? null,
			url: (protocolMeta?.slug ? referralUrls.get(protocolMeta.slug) : undefined) ?? market.url ?? null,
			protocolName: market.protocol,
			assets: []
		}
	}
}

const getServerSidePropsHandler: GetServerSideProps<PoolDetailViewProps> = async ({ params, query, res }) => {
	const poolParam = params?.pool
	const id = typeof poolParam === 'string' ? poolParam : Array.isArray(poolParam) ? poolParam[0] : null
	if (!id) return { notFound: true }

	// Chart range is URL-driven (?range=), defaulting to max — so deep links/refresh first-paint
	// at the right window. The client fetches wider ranges on demand and slices narrower locally.
	const initialRange = getPoolHistoryRange(query.range)
	const { acquireYieldsSnapshot } = await import('~/containers/Yields/server/dataset.server')
	const snapshot = await acquireYieldsSnapshot('blocking')

	// The risk-entry check only needs the pool id, so it runs alongside the pool data
	// (hasVaultRisk never throws — it resolves false on any failure).
	const { hasVaultRisk } = await import('~/containers/Yields/VaultRisk/loader')
	const [pool, hasRisk] = await Promise.all([optionalResource(() => fetchPoolDetail(id)), hasVaultRisk(id)])
	if (!pool) {
		// Borrow-only market: no earn row, fall back to the borrow-markets detail endpoint.
		const market = await optionalResource(() => fetchBorrowMarketDetail(id))
		if (!market) return { notFound: true }
		res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=600')
		return { props: { ...(await buildBorrowOnlyProps(snapshot, id, market, initialRange)), hasRisk } }
	}

	// `available_history` gates the history fetch (fallback: assume supply history exists).
	// Pools that are also borrow markets carry borrow history — fetch it so the page can
	// render the borrow APY chart alongside the supply one, as the old page did.
	const available = pool.available_history ?? { supply: true, borrow: false }
	const metaPromise = readYieldsMeta(snapshot)
	const [history, borrowHistory, meta, borrowMarket, referralUrls] = await Promise.all([
		available.supply ? optionalResource(() => fetchPoolDetailHistory(id, initialRange)) : Promise.resolve(null),
		available.borrow ? optionalResource(() => fetchBorrowMarketDetailHistory(id, initialRange)) : Promise.resolve(null),
		metaPromise,
		available.borrow ? optionalResource(() => fetchBorrowMarketDetail(id)) : Promise.resolve(null),
		getReferralUrls(snapshot)
	])

	// Rows carry plain protocol/chain NAME strings; join slug / category / audit from /v2/meta.
	const protocolMeta = meta.protocols.find((p) => p.name === pool.protocol) ?? null
	const chainMeta = meta.chains.find((c) => c.name === pool.chain) ?? null
	const categorySlugByName = new Map(meta.categories.map((c) => [c.name, c.slug]))
	const categorySlug = protocolMeta?.category ? (categorySlugByName.get(protocolMeta.category) ?? null) : null
	const usesSupplyLabel = categorySlug ? SUPPLY_HEADER_CATEGORIES.has(categorySlug) : false

	const supplyChart = history?.length ? buildSupplyChart(history, usesSupplyLabel ? 'Total supplied' : 'TVL') : null
	const borrowChart = borrowHistory?.length ? buildBorrowChart(borrowHistory) : null

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

	const stabilityAvailable = getPoolStability(pool) != null

	res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=600')

	return {
		props: {
			hasRisk,
			poolId: id,
			mode: 'pool',
			initialRange,
			symbol: pool.display?.label ?? '—',
			name: pool.display?.detail ?? '',
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
			holders: pool.holders ?? null,
			stabilityAvailable,
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
