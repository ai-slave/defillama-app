type Dict = Record<string, unknown>

export type BreakdownSections = { depth: Dict; volume: Dict; spread: Dict; kpi: Dict }

export type ReconstructedBreakdown = {
	aggregatedRank: Dict | null
	depthRank: Dict | null
	volumeRank: Dict | null
	spreadRank: Dict | null
	kpiRank: Dict | null
	sections: BreakdownSections
}

export type BreakdownPayloads = {
	aggregated: unknown
	depth: unknown
	volume: unknown
	spread: unknown
	kpi: unknown
}

function asRows(value: unknown): Dict[] {
	return Array.isArray(value) ? (value.filter((r) => r && typeof r === 'object') as Dict[]) : []
}

function findRow(rows: Dict[], id: string | null): Dict | null {
	if (id == null) return null
	return rows.find((r) => r.marketMakerId === id) ?? null
}

function rankOf(row: Dict | null): Dict | null {
	const r = row?.rank
	return r && typeof r === 'object' ? (r as Dict) : null
}

const DEPTH_BUCKETS = [50, 100, 200] as const

export function reconstructBreakdown(id: string | null, payloads: BreakdownPayloads): ReconstructedBreakdown {
	const agg = findRow(asRows(payloads.aggregated), id)
	const vol = findRow(asRows(payloads.volume), id)
	const spr = findRow(asRows(payloads.spread), id)
	const kpi = findRow(asRows(payloads.kpi), id)

	const depthRoot = (payloads.depth ?? {}) as Dict
	const depthRows: Record<number, Dict | null> = {}
	for (const t of DEPTH_BUCKETS) {
		depthRows[t] = findRow(asRows(depthRoot[`depth${t}`]), id)
	}

	const depth: Dict = {}
	for (const t of DEPTH_BUCKETS) {
		const r = depthRows[t] ?? {}
		depth[`bidDepth${t}`] = r.bidDepth ?? null
		depth[`askDepth${t}`] = r.askDepth ?? null
		depth[`bidAskDepth${t}`] = r.bidAskDepth ?? null
		depth[`bidDepth${t}MarketPercentage`] = r.bidDepthMarketPercentage ?? null
		depth[`askDepth${t}MarketPercentage`] = r.askDepthMarketPercentage ?? null
		depth[`bidAskDepth${t}MarketPercentage`] = r.bidAskDepthMarketPercentage ?? null
		depth[`bidAskDepth${t}Uptime`] = r.uptime ?? null
		depth[`bidAskDepth${t}LoanUtilization`] = r.depthLoanUtilization ?? null
	}

	const volume: Dict = {
		volumeMaker: vol?.orderFillVolumeMaker ?? null,
		volumeTaker: vol?.orderFillVolumeTaker ?? null,
		volumeTotal: vol?.orderFillVolumeTotal ?? null,
		volumeMakerMarketPercentage: vol?.orderFillVolumeMakerMarketPercentage ?? null,
		volumeTakerMarketPercentage: vol?.orderFillVolumeTakerMarketPercentage ?? null,
		volumeTotalMarketPercentage: vol?.orderFillVolumeTotalMarketPercentage ?? null,
		volumeMakerLoanUtilization: null,
		volumeTakerLoanUtilization: null,
		volumeTotalLoanUtilization: vol?.volumeLoanUtilization ?? null
	}

	const spread: Dict = {
		bidAskSpread: spr?.bidAskSpread ?? null,
		spreadUptime: spr?.uptime ?? null
	}

	const kpiSection: Dict = {
		bidAskDepth50: kpi?.bidAskDepth50 ?? null,
		bidAskDepth100: kpi?.bidAskDepth100 ?? null,
		bidAskDepth200: kpi?.bidAskDepth200 ?? null,
		bidAskSpread: kpi?.bidAskSpread ?? null
	}

	return {
		aggregatedRank: rankOf(agg),
		// The Depth board card mirrors the default 2% (depth200) bucket the leaderboard shows.
		depthRank: rankOf(depthRows[200]),
		volumeRank: rankOf(vol),
		spreadRank: rankOf(spr),
		kpiRank: rankOf(kpi),
		sections: { depth, volume, spread, kpi: kpiSection }
	}
}
