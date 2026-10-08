import { fetchProtocols } from '~/containers/ProtocolLists/api'
import type { ParentProtocolLite, ProtocolLite, ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import { fetchRaisesFromNetwork } from '~/containers/Raises/api'
import type { Raise, RaisesResponse } from '~/containers/Raises/model'
import { readYieldsMeta, type YieldsSnapshot } from '../snapshot'
import type { YieldsMeta } from '../types'

// A protocol-slug → latest fundraise valuation (whole USD) map. Ported from main's
// `buildRaiseValuationsUsd` (normalizers/pageData.ts): the raise data decorates the
// "Potential Airdrop" hint on token-less protocols with the protocol's last known
// valuation. Kept app-side (yield-server-v2 is not touched) and keyed by the v2 protocol
// slug so earn / borrow / loop rows can look it up by `protocolSlug`.

// Just the protocol identity fields the builder needs (from /v2/meta protocols[]).
type ProtocolIdentity = { slug: string; name: string }

// Build slug → valuation from raises + the protocols-lite hierarchy. Mirrors main exactly:
// index raises by defillamaId AND lowercased name (most-recent-first, first write wins);
// the protocols-lite parent hierarchy lets a child protocol inherit its parent's raise.
export function buildRaiseValuationsUsd(
	raises: Array<Raise>,
	protocols: Array<ProtocolIdentity>,
	protocolsLite: Pick<ProtocolsResponse, 'protocols' | 'parentProtocols'>
): Map<string, number> {
	const sorted = raises.toSorted((a, b) => b.date - a.date)

	// Index raises by defillamaId and name (most recent wins).
	const byId = new Map<string, number>()
	const byName = new Map<string, number>()
	for (const r of sorted) {
		const val = r.valuationUsd
		if (val == null || !Number.isFinite(val) || val <= 0) continue
		if (r.defillamaId && !byId.has(String(r.defillamaId))) byId.set(String(r.defillamaId), val)
		if (r.name && !byName.has(r.name.trim().toLowerCase())) byName.set(r.name.trim().toLowerCase(), val)
	}

	const liteProtocols = protocolsLite.protocols
	const parents = protocolsLite.parentProtocols

	// Protocol lookups
	const liteByName = new Map<string, ProtocolLite>()
	const childrenByParent = new Map<string, Array<ProtocolLite>>()
	for (const p of liteProtocols) {
		liteByName.set(p.name.toLowerCase(), p)
		if (p.parentProtocol) {
			const siblings = childrenByParent.get(p.parentProtocol)
			if (siblings) siblings.push(p)
			else childrenByParent.set(p.parentProtocol, [p])
		}
	}

	// Parent protocol name + valuation lookups
	const parentNameById = new Map<string, string>()
	const valByParentName = new Map<string, number>()
	for (const pp of parents) {
		parentNameById.set(pp.id, pp.name)
		if (pp.name.length < 4) continue
		const name = pp.name.trim().toLowerCase()
		let val = byId.get(pp.id)
		if (val == null) {
			for (const child of childrenByParent.get(pp.id) ?? []) {
				val = byId.get(child.defillamaId)
				if (val != null) break
			}
		}
		if (val == null) val = byName.get(name)
		if (val != null) valByParentName.set(name, val)
	}

	// Match protocol slugs → valuations (4-tier cascade, same order as main)
	const result = new Map<string, number>()
	for (const { slug, name: protocolName } of protocols) {
		if (!slug || !protocolName) continue
		const proto = liteByName.get(protocolName.toLowerCase())
		let val: number | undefined

		// 1: direct defillamaId
		if (proto) {
			val = byId.get(proto.defillamaId)
			// 2: parent protocol (by id, then by name)
			if (val == null && proto.parentProtocol) {
				val = byId.get(proto.parentProtocol)
				if (val == null) {
					const pName = parentNameById.get(proto.parentProtocol)
					if (pName) val = byName.get(pName.toLowerCase())
				}
			}
		}
		// 3: exact protocol name → raise name
		if (val == null) val = byName.get(protocolName.toLowerCase())
		// 4: protocol name starts with parent protocol name (e.g. "Phantom SOL" → "Phantom")
		if (val == null) {
			const lower = protocolName.toLowerCase()
			for (const [pName, pVal] of valByParentName) {
				if (lower.startsWith(`${pName} `)) {
					val = pVal
					break
				}
			}
		}

		if (val != null) result.set(slug, val)
	}
	return result
}

// A protocol-slug → referral URL map from the same protocols-lite blob. Mirrors the
// protocol pages' website link (ProtocolOverview prefers `referralUrl` over `url`): a
// protocol's own referral link wins, else it inherits its parent's (e.g. GMX markets).
// Rows apply it through `withReferral`, which keeps the pool's own link when it can.
export function buildReferralUrls(
	protocols: Array<ProtocolIdentity>,
	protocolsLite: Pick<ProtocolsResponse, 'protocols' | 'parentProtocols'>
): Map<string, string> {
	const liteByName = new Map<string, ProtocolLite>()
	for (const p of protocolsLite.protocols) {
		liteByName.set(p.name.toLowerCase(), p)
	}
	const parentById = new Map<string, ParentProtocolLite>()
	for (const pp of protocolsLite.parentProtocols) {
		parentById.set(pp.id, pp)
	}

	const result = new Map<string, string>()
	for (const { slug, name } of protocols) {
		if (!slug || !name) continue
		const proto = liteByName.get(name.toLowerCase())
		if (!proto) continue
		const referralUrl =
			proto.referralUrl?.trim() ||
			(proto.parentProtocol ? parentById.get(proto.parentProtocol)?.referralUrl?.trim() : undefined)
		if (referralUrl) result.set(slug, referralUrl)
	}
	return result
}

// Carry a protocol's query-param referral onto the pool's own URL so the outbound link still
// opens the pool. A referral on another host, in the path, on a page the pool is not under, or
// against a bare homepage URL replaces the pool URL as before. Hash-routed apps (`#/?ref=x`)
// take it in the hash.
export function withReferral(url: string | null | undefined, referralUrl: string | undefined): string | null {
	if (!referralUrl) return url ?? null
	if (!url) return referralUrl
	let pool: URL
	let ref: URL
	try {
		pool = new URL(url)
		ref = new URL(referralUrl)
	} catch {
		return referralUrl
	}
	if (pool.host.replace(/^www\./, '') !== ref.host.replace(/^www\./, '')) return referralUrl
	const poolHashRoute = pool.hash.startsWith('#/')
	if (pool.pathname === '/' && !pool.search && !poolHashRoute) return referralUrl

	const refHashQuery = ref.hash.indexOf('?')
	const inHash = refHashQuery !== -1
	if (inHash ? !poolHashRoute : !ref.search) return referralUrl

	// A referral on its own page (`/referrals/?ref=x`) may only register there, so it merges
	// only into pools under that page. A homepage referral is read app-wide.
	const route = (u: URL) => (inHash ? u.hash.slice(1).split('?')[0] : u.pathname).replace(/\/+$/, '')
	const refRoute = route(ref)
	const poolRoute = route(pool)
	if (refRoute && poolRoute !== refRoute && !poolRoute.startsWith(`${refRoute}/`)) return referralUrl

	// Append the referral's raw query: re-serializing through URLSearchParams would re-encode the
	// pool's own params (`:` → `%3A`, `%20` → `+`).
	if (inHash) pool.hash = `${pool.hash}${pool.hash.includes('?') ? '&' : '?'}${ref.hash.slice(refHashQuery + 1)}`
	else pool.search = pool.search ? `${pool.search}&${ref.search.slice(1)}` : ref.search
	return pool.toString()
}

// Raises + protocols-lite are slow-moving external APIs (not the Yields snapshot), so the
// built maps are memoized at module level behind a TTL — mirrors Raises/api.ts'
// `fetchRaisesWithShortCache` (cache the promise, clear on failure). Keeps the SSR hot path
// (every earn/borrow/loop request) free of per-request external fetches.
const CACHE_TTL_MS = 10 * 60_000

function buildProtocolParents(
	protocolsLite: Pick<ProtocolsResponse, 'protocols' | 'parentProtocols'>
): Map<string, string> {
	const parentNameById = new Map<string, string>()
	for (const pp of protocolsLite.parentProtocols) parentNameById.set(pp.id, pp.name)
	const result = new Map<string, string>()
	for (const p of protocolsLite.protocols) {
		const parentName = p.parentProtocol ? parentNameById.get(p.parentProtocol) : undefined
		if (parentName) result.set(p.name.toLowerCase(), parentName)
	}
	return result
}

interface ProtocolJoins {
	raiseValuationsUsd: Map<string, number>
	referralUrls: Map<string, string>
	protocolParents: Map<string, string>
}

let cache: { meta: YieldsMeta; expiresAt: number; value: Promise<ProtocolJoins> } | null = null

async function buildFromSources(meta: YieldsMeta): Promise<ProtocolJoins> {
	const [raisesResponse, protocolsLite] = await Promise.all([
		fetchRaisesFromNetwork().catch((): RaisesResponse => ({ raises: [] })),
		fetchProtocols().catch((): ProtocolsResponse => ({
			protocols: [],
			chains: [],
			parentProtocols: [],
			protocolCategories: []
		}))
	])
	return {
		raiseValuationsUsd: buildRaiseValuationsUsd(raisesResponse.raises, meta.protocols, protocolsLite),
		referralUrls: buildReferralUrls(meta.protocols, protocolsLite),
		protocolParents: buildProtocolParents(protocolsLite)
	}
}

async function getProtocolJoins(snapshot: YieldsSnapshot): Promise<ProtocolJoins> {
	const meta = await readYieldsMeta(snapshot)
	const now = Date.now()
	if (!cache || cache.meta !== meta || cache.expiresAt <= now) {
		const value = buildFromSources(meta).catch((error) => {
			if (cache?.value === value) cache = null
			throw error
		})
		cache = { meta, expiresAt: now + CACHE_TTL_MS, value }
	}
	return cache.value
}

export async function getRaiseValuationsUsd(snapshot: YieldsSnapshot): Promise<Map<string, number>> {
	return (await getProtocolJoins(snapshot)).raiseValuationsUsd
}

export async function getReferralUrls(snapshot: YieldsSnapshot): Promise<Map<string, string>> {
	return (await getProtocolJoins(snapshot)).referralUrls
}

export async function getProtocolParents(snapshot: YieldsSnapshot): Promise<Map<string, string>> {
	return (await getProtocolJoins(snapshot)).protocolParents
}
