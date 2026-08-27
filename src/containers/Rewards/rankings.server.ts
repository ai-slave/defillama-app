import type { AdapterChainProtocol } from '~/containers/AdapterMetrics/api.types'
import type { ProtocolLite } from '~/containers/ProtocolLists/api.types'

export function buildRewardsRankings(
	protocols: Pick<ProtocolLite, 'defillamaId' | 'parentProtocol' | 'tvl' | 'chainTvls'>[],
	fees: Pick<AdapterChainProtocol, 'defillamaId' | 'parentProtocol' | 'total30d'>[]
) {
	const parentById = new Map<string, string>()
	const tvlById = new Map<string, number | null>()
	const parentTvl = new Map<string, number | null>()
	const feesById = new Map<string, number | null>()
	const parentFees = new Map<string, number>()
	for (const protocol of protocols) {
		tvlById.set(protocol.defillamaId, protocol.tvl)
		if (!protocol.parentProtocol) continue
		parentById.set(protocol.defillamaId, protocol.parentProtocol)
		// Metadata-only children contribute no base TVL. Subtract canonical overlap
		// before summing the complete family, just as the protocol rankings do.
		if (protocol.tvl === null) continue
		const excluded = protocol.chainTvls.excludeParent
		const contribution = excluded?.tvl === null ? null : protocol.tvl - (excluded?.tvl ?? 0)
		const current = parentTvl.get(protocol.parentProtocol)
		parentTvl.set(
			protocol.parentProtocol,
			current === null || contribution === null ? null : (current ?? 0) + contribution
		)
	}
	for (const protocol of fees) {
		feesById.set(protocol.defillamaId, protocol.total30d ?? null)
		const parent = protocol.parentProtocol ?? parentById.get(protocol.defillamaId)
		if (parent) {
			parentById.set(protocol.defillamaId, parent)
			// Activity totals sum measured siblings; an entirely unmeasured family
			// stays unavailable rather than acquiring a zero.
			if (protocol.total30d != null) parentFees.set(parent, (parentFees.get(parent) ?? 0) + protocol.total30d)
		}
	}
	for (const [id, tvl] of parentTvl) tvlById.set(id, tvl)
	for (const [id, total] of parentFees) {
		// A producer-supplied parent is already aggregated, including when null.
		if (!feesById.has(id)) feesById.set(id, total)
	}
	return { parentById, tvlById, feesById }
}
