import { fetchProtocols } from '~/containers/ProtocolLists/api'
import type { ParentProtocolLite, ProtocolLite, ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import { fetchRaisesFromNetwork } from '~/containers/Raises/api'
import type { RawRaise } from '~/containers/Raises/api.types'
import { readYieldsMeta, type YieldsSnapshot } from '../snapshot'
import type { YieldsMeta } from '../types'

// A protocol-slug → latest fundraise valuation (USD millions) map. Ported from main's
// `buildRaiseValuations` (normalizers/pageData.ts): the raise data decorates the
// "Potential Airdrop" hint on token-less protocols with the protocol's last known
// valuation. Kept app-side (yield-server-v2 is not touched) and keyed by the v2 protocol
// slug so earn / borrow / loop rows can look it up by `protocolSlug`.

// Just the protocol identity fields the builder needs (from /v2/meta protocols[]).
type ProtocolIdentity = { slug: string; name: string }

// Build slug → valuation from raises + the protocols-lite hierarchy. Mirrors main exactly:
// index raises by defillamaId AND lowercased name (most-recent-first, first write wins);
// the protocols-lite parent hierarchy lets a child protocol inherit its parent's raise.
export function buildRaiseValuations(
	raises: RawRaise[],
	protocols: ProtocolIdentity[],
	protocolsLite: { protocols?: ProtocolLite[]; parentProtocols?: ParentProtocolLite[] }
): Map<string, number> {
	const sorted = raises.toSorted((a, b) => b.date - a.date)

	// Index raises by defillamaId and name (most recent wins).
	const byId = new Map<string, number>()
	const byName = new Map<string, number>()
	for (const r of sorted) {
		const val = Number(r.valuation)
		if (!Number.isFinite(val) || val <= 0) continue
		if (r.defillamaId && !byId.has(String(r.defillamaId))) byId.set(String(r.defillamaId), val)
		if (r.name && !byName.has(r.name.trim().toLowerCase())) byName.set(r.name.trim().toLowerCase(), val)
	}

	const liteProtocols = protocolsLite.protocols ?? []
	const parents = protocolsLite.parentProtocols ?? []

	// Protocol lookups
	const liteByName = new Map<string, ProtocolLite>()
	const childrenByParent = new Map<string, ProtocolLite[]>()
	for (const p of liteProtocols) {
		if (p.name) liteByName.set(p.name.toLowerCase(), p)
		if (p.parentProtocol) {
			if (!childrenByParent.has(p.parentProtocol)) childrenByParent.set(p.parentProtocol, [])
			childrenByParent.get(p.parentProtocol)!.push(p)
		}
	}

	// Parent protocol name + valuation lookups
	const parentNameById = new Map<string, string>()
	const valByParentName = new Map<string, number>()
	for (const pp of parents) {
		if (pp.id && pp.name) parentNameById.set(pp.id, pp.name)
		if (!pp.name || pp.name.length < 4) continue
		const name = pp.name.trim().toLowerCase()
		let val = byId.get(pp.id)
		if (val == null) {
			for (const child of childrenByParent.get(pp.id) ?? []) {
				val = byId.get(String(child.defillamaId ?? child.id ?? ''))
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
			val = byId.get(String(proto.defillamaId ?? proto.id ?? ''))
			// 2: parent protocol (by id, then by name)
			if (val == null && proto.parentProtocol) {
				val = byId.get(String(proto.parentProtocol))
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
				if (lower.startsWith(pName + ' ')) {
					val = pVal
					break
				}
			}
		}

		if (val != null) result.set(slug, val)
	}
	return result
}

// Raises + protocols-lite are slow-moving external APIs (not the Yields snapshot), so the
// built map is memoized at module level behind a TTL — mirrors Raises/api.ts'
// `fetchRaisesWithShortCache` (cache the promise, clear on failure). Keeps the SSR hot path
// (every earn/borrow/loop request) free of per-request external fetches.
const CACHE_TTL_MS = 10 * 60_000

let cache: { meta: YieldsMeta; expiresAt: number; value: Promise<Map<string, number>> } | null = null

async function buildFromSources(meta: YieldsMeta): Promise<Map<string, number>> {
	const [raisesResponse, protocolsLite] = await Promise.all([
		fetchRaisesFromNetwork().catch((): { raises: RawRaise[] } => ({ raises: [] })),
		fetchProtocols().catch((): ProtocolsResponse => ({ protocols: [], chains: [], parentProtocols: [] }))
	])
	return buildRaiseValuations(raisesResponse?.raises ?? [], meta.protocols, protocolsLite)
}

export async function getRaiseValuations(snapshot: YieldsSnapshot): Promise<Map<string, number>> {
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
