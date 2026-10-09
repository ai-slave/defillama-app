import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import type { TreemapNode } from '~/components/ECharts/TreemapChart/types'
import { assignUniqueColors, CHART_COLORS, CHART_SERIES_LIMIT, oldBlue, OTHERS_COLOR } from '~/constants/colors'
import { roundNumber } from '~/utils/numberFormat'

const HORIZONTAL_BAR_SLICE_LIMIT = 9

type MarketCapSlice = { name: string; value: number; color: string }

export type StablecoinMarketCapSeries = {
	kind: 'pie' | 'hbar' | 'treemap'
	peers: Array<MarketCapSlice>
	selectionSeries: Array<string>
	defaultSeries: Array<string>
	upstreamRemainderValue: number
}

export type StablecoinMarketCapPresentation =
	| { kind: 'pie'; chartData: Array<{ name: string; value: number }>; stackColors: Record<string, string> }
	| { kind: 'hbar'; categories: Array<string>; values: Array<number>; colors: Array<string> }
	| { kind: 'treemap'; treeData: Array<TreemapNode> }

/**
 * Export the picked peers without the top-N fold. The pie and treemap are share views, so `Others` holds the rest of
 * the whole; the bar view shows values, so its `Others` is the upstream remainder only while every peer is picked.
 */
export function buildStablecoinMarketCapCsvDataset({
	series,
	selectedSeries
}: {
	series: StablecoinMarketCapSeries
	selectedSeries: ReadonlySet<string>
}): MultiSeriesChartDataset {
	const source: MultiSeriesChartDataset['source'] = []
	let unpickedValue = 0
	for (const peer of series.peers) {
		if (selectedSeries.has(peer.name)) source.push([peer.name, peer.value])
		else unpickedValue += peer.value
	}
	const othersValue =
		series.kind === 'hbar'
			? unpickedValue === 0
				? series.upstreamRemainderValue
				: 0
			: unpickedValue + series.upstreamRemainderValue
	if (source.length > 0 && othersValue > 0) source.push(['Others', othersValue])
	return { dimensions: ['Name', 'Market Cap'], source }
}

/** Build one canonical ranked snapshot; every real peer remains selectable. */
export function prepareStablecoinMarketCapSeries<T>({
	rows,
	view,
	getName,
	getValue,
	isAggregateIncluded = () => true
}: {
	rows: Array<T>
	view: StablecoinMarketCapSeries['kind']
	getName: (row: NoInfer<T>) => string
	getValue: (row: NoInfer<T>) => number
	isAggregateIncluded?: (row: NoInfer<T>) => boolean
}): StablecoinMarketCapSeries {
	const valueByPeer = new Map<string, number>()
	const aggregateIncludedPeers = new Set<string>()
	let upstreamRemainderValue = 0

	for (const row of rows) {
		const value = getValue(row)
		const name = getName(row)
		if (name === 'Others') {
			upstreamRemainderValue += value
			continue
		}
		// The pie and treemap are shares of the aggregate market, which leaves out double-counted assets, so only the
		// bar view offers them.
		if (view !== 'hbar' && !isAggregateIncluded(row)) continue
		valueByPeer.set(name, (valueByPeer.get(name) ?? 0) + value)
		if (isAggregateIncluded(row)) aggregateIncludedPeers.add(name)
	}
	const rankedPeers: Array<{ name: string; value: number }> = []
	for (const [name, value] of valueByPeer) {
		if (value > 0) rankedPeers.push({ name, value })
	}
	rankedPeers.sort((left, right) => right.value - left.value)
	const peers = rankedPeers.map<MarketCapSlice>((peer, index) => ({
		...peer,
		color: CHART_COLORS[index % CHART_COLORS.length] ?? oldBlue
	}))

	const selectionSeries = peers.map((peer) => peer.name)
	return {
		kind: view,
		peers,
		selectionSeries,
		defaultSeries: selectionSeries.filter((name) => aggregateIncludedPeers.has(name)),
		upstreamRemainderValue: upstreamRemainderValue > 0 ? upstreamRemainderValue : 0
	}
}

/** Rank the selected peers into the renderer's existing top-N presentation. */
export function buildStablecoinMarketCapPresentation({
	series,
	selectedSeries
}: {
	series: StablecoinMarketCapSeries
	selectedSeries?: ReadonlySet<string>
}): StablecoinMarketCapPresentation {
	if (series.kind === 'treemap') {
		// A share view: tiles are shares of the whole market, and unpicked peers plus the upstream remainder share one
		// Others tile.
		const visibleSlices: Array<MarketCapSlice> = []
		let total = series.upstreamRemainderValue
		let othersValue = series.upstreamRemainderValue
		for (const peer of series.peers) {
			total += peer.value
			if (selectedSeries && !selectedSeries.has(peer.name)) othersValue += peer.value
			else if (peer.value > 0) visibleSlices.push(peer)
		}
		if (visibleSlices.length > 0 && othersValue > 0) {
			visibleSlices.push({ name: 'Others', value: othersValue, color: OTHERS_COLOR })
		}
		const treeData: Array<TreemapNode> = []
		for (const slice of visibleSlices) {
			const share = total > 0 ? roundNumber((slice.value / total) * 100, 2) : 0
			treeData.push({
				name: slice.name,
				path: `Stablecoins/${slice.name}`,
				value: [slice.value, share, share],
				itemStyle: { color: slice.color }
			})
		}
		return { kind: 'treemap', treeData }
	}

	// The pie is a share view, so unpicked peers and the upstream remainder always join Others; the bar view shows
	// values, so unpicking a peer removes it and the upstream remainder shows only while every peer is picked.
	const limit = series.kind === 'pie' ? CHART_SERIES_LIMIT : HORIZONTAL_BAR_SLICE_LIMIT
	const visibleSlices: Array<MarketCapSlice> = []
	let selectedPeerCount = 0
	let unpickedValue = 0
	let othersValue = 0
	for (const peer of series.peers) {
		if (selectedSeries && !selectedSeries.has(peer.name)) {
			unpickedValue += peer.value
			continue
		}
		selectedPeerCount++
		if (visibleSlices.length < limit) visibleSlices.push(peer)
		else othersValue += peer.value
	}
	if (series.kind === 'pie') othersValue += unpickedValue + series.upstreamRemainderValue
	else if (selectedPeerCount === series.peers.length) othersValue += series.upstreamRemainderValue
	if (selectedPeerCount === 0 && series.peers.length > 0) othersValue = 0
	if (othersValue > 0) {
		visibleSlices.push({
			name: 'Others',
			value: othersValue,
			color: OTHERS_COLOR
		})
	}

	if (series.kind === 'pie') {
		const chartData: Array<{ name: string; value: number }> = []
		for (const slice of visibleSlices) chartData.push({ name: slice.name, value: slice.value })
		return { kind: 'pie', chartData, stackColors: assignUniqueColors(visibleSlices) }
	}

	const categories: Array<string> = []
	const values: Array<number> = []
	const colors: Array<string> = []
	for (const slice of visibleSlices) {
		categories.push(slice.name)
		values.push(slice.value)
		colors.push(slice.color)
	}
	return { kind: 'hbar', categories, values, colors }
}
