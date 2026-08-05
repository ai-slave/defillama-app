import type { IFetchedRWAProject } from '~/containers/RWA/api.types'
import { aggregateRwaMetrics, hasMetricBreakdown } from '~/containers/RWA/overviewAssembly'
import { rwaSlug } from '~/containers/RWA/rwaSlug'

export type RWAAssetTableRow = {
	name: string
	ticker: string
	assetGroup: string
	activeMcap: number | null
	onChainMcap: number | null
	defiActiveTvl: number
	category: string
	type: string
}

function buildMetricValues(asset: IFetchedRWAProject, chain?: string) {
	const onChainMcapBreakdown = hasMetricBreakdown(asset.onChainMcap) ? asset.onChainMcap : null
	const activeMcapBreakdown = hasMetricBreakdown(asset.activeMcap) ? asset.activeMcap : null
	const selectedChain = chain && chain !== 'All' ? rwaSlug(chain) : undefined
	const metrics = aggregateRwaMetrics({
		onChainMcapBreakdown,
		activeMcapBreakdown,
		defiActiveTvlBreakdown: asset.defiActiveTvl,
		...(selectedChain === undefined ? {} : { selectedChain })
	})

	return {
		isOnSelectedChain:
			selectedChain === undefined ||
			metrics.hasSelectedChainData.onChainMcap ||
			metrics.hasSelectedChainData.activeMcap ||
			metrics.hasSelectedChainData.defiActiveTvl,
		onChainMcap: onChainMcapBreakdown
			? selectedChain
				? metrics.filteredTotals.onChainMcap
				: metrics.totals.onChainMcap
			: null,
		activeMcap: activeMcapBreakdown
			? selectedChain
				? metrics.filteredTotals.activeMcap
				: metrics.totals.activeMcap
			: null,
		defiActiveTvl: selectedChain ? metrics.filteredTotals.defiActiveTvl : metrics.totals.defiActiveTvl
	}
}

function buildBaseRow(asset: IFetchedRWAProject, values: ReturnType<typeof buildMetricValues>): RWAAssetTableRow {
	return {
		name: asset.assetName || asset.ticker || asset.id,
		ticker: asset.ticker,
		assetGroup: asset.assetGroup || '',
		activeMcap: values.activeMcap,
		onChainMcap: values.onChainMcap,
		defiActiveTvl: values.defiActiveTvl,
		category: asset.category?.join(', ') ?? '',
		type: asset.type || ''
	}
}

export function buildRWAAllChainsAssetTableRows(data: IFetchedRWAProject[]): RWAAssetTableRow[] {
	const rows: RWAAssetTableRow[] = []
	for (const asset of data) {
		if (asset.stablecoin || asset.governance) continue
		const values = buildMetricValues(asset)
		rows.push(buildBaseRow(asset, values))
	}
	return rows
}

export function buildRWAChainAssetTableRows(data: IFetchedRWAProject[], chain: string): RWAAssetTableRow[] {
	const rows: RWAAssetTableRow[] = []
	for (const asset of data) {
		if (asset.stablecoin || asset.governance) continue
		const values = buildMetricValues(asset, chain)
		if (!values.isOnSelectedChain) continue
		rows.push(buildBaseRow(asset, values))
	}
	return rows
}
