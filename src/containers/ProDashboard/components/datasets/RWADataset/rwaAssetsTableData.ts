import type { IFetchedRWAProject } from '~/containers/RWA/api.types'
import { aggregateRwaMetrics, hasMetricBreakdown } from '~/containers/RWA/overviewAssembly'
import { rwaSlug } from '~/containers/RWA/rwaSlug'
import type { CsvCell } from '~/utils/csvCell'

export type RWAAssetTableRow = {
	name: string
	ticker: string
	assetGroup: string
	activeMcap: number | null
	onChainMcap: number | null
	defiActiveTvl: number
	category: string
	type: string
	suspicious: boolean
	suspiciousReason: string
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
		type: asset.type || '',
		suspicious: asset.suspicious === true,
		suspiciousReason: asset.suspiciousReason ?? ''
	}
}

export function buildRWAAllChainsAssetTableRows(data: Array<IFetchedRWAProject>): Array<RWAAssetTableRow> {
	const rows: Array<RWAAssetTableRow> = []
	for (const asset of data) {
		if (asset.stablecoin || asset.governance) continue
		const values = buildMetricValues(asset)
		rows.push(buildBaseRow(asset, values))
	}
	return rows
}

export function buildRWAChainAssetTableRows(data: Array<IFetchedRWAProject>, chain: string): Array<RWAAssetTableRow> {
	const rows: Array<RWAAssetTableRow> = []
	for (const asset of data) {
		if (asset.stablecoin || asset.governance) continue
		const values = buildMetricValues(asset, chain)
		if (!values.isOnSelectedChain) continue
		rows.push(buildBaseRow(asset, values))
	}
	return rows
}

export function buildRWAAssetCsv(rows: Array<RWAAssetTableRow>, includeTicker: boolean): Array<Array<CsvCell>> {
	const headers: Array<CsvCell> = ['Name']
	if (includeTicker) headers.push('Ticker')
	headers.push(
		'Asset Group',
		'Active AUM',
		'Onchain AUM',
		'DeFi Active TVL',
		'Category',
		'Type',
		'Suspicious',
		'Suspicious reason'
	)
	const csv: Array<Array<CsvCell>> = [headers]
	for (const item of rows) {
		const row: Array<CsvCell> = [item.name]
		if (includeTicker) row.push(item.ticker)
		row.push(
			item.assetGroup,
			item.activeMcap,
			item.onChainMcap,
			item.defiActiveTvl,
			item.category,
			item.type,
			item.suspicious,
			item.suspiciousReason
		)
		csv.push(row)
	}
	return csv
}
