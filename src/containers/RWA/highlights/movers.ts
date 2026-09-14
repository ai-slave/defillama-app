import type { IRWAFlowSummaryResponse, RWAAssetOverviewRow, RWAOverviewDisplayRow } from '../api.types'
import { percentChange } from '../table/change'

export type RWAMover = { asset: RWAAssetOverviewRow; flow: number; change7d: number | null }
export type RWAMovers = { inflows: Array<RWAMover>; outflows: Array<RWAMover> }

export const RWA_MOVERS_LIMIT = 5

/** Largest 7d inflows and outflows among spot rows. */
export function getRwaMovers(
	assets: Array<RWAOverviewDisplayRow>,
	flowSummary: IRWAFlowSummaryResponse | undefined,
	limit = RWA_MOVERS_LIMIT
): RWAMovers {
	const movers: Array<RWAMover> = []
	if (flowSummary) {
		for (const asset of assets) {
			if (asset.kind !== 'spot') continue
			const flow = flowSummary.windows['7d'].asset[asset.canonicalMarketId]?.flow
			if (flow == null || flow === 0) continue
			movers.push({
				asset,
				flow,
				change7d: percentChange(asset.activeMcap?.total, asset.priors?.['7d'].activeMcap)
			})
		}
	}
	const inflows = movers.filter((mover) => mover.flow > 0).sort((a, b) => b.flow - a.flow)
	const outflows = movers.filter((mover) => mover.flow < 0).sort((a, b) => a.flow - b.flow)
	return { inflows: inflows.slice(0, limit), outflows: outflows.slice(0, limit) }
}
