import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import type { TreemapNode } from '~/components/ECharts/TreemapChart/types'
import { CHART_COLORS, oldBlue } from '~/constants/colors'
import { roundNumber } from '~/utils/numberFormat'

const PIE_SLICE_LIMIT = 10
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

/** Export every canonical peer; visual top-N and legend state are presentation-only. */
export function buildStablecoinMarketCapCsvDataset(series: StablecoinMarketCapSeries): MultiSeriesChartDataset {
	const source: MultiSeriesChartDataset['source'] = []
	for (const peer of series.peers) source.push([peer.name, peer.value])
	if (series.upstreamRemainderValue > 0) source.push(['Others', series.upstreamRemainderValue])
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
		const visibleSlices: Array<MarketCapSlice> = []
		for (const peer of series.peers) {
			if (peer.value <= 0 || (selectedSeries && !selectedSeries.has(peer.name))) continue
			visibleSlices.push(peer)
		}

		let total = 0
		for (const slice of visibleSlices) total += slice.value
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

	const limit = series.kind === 'pie' ? PIE_SLICE_LIMIT : HORIZONTAL_BAR_SLICE_LIMIT
	const visibleSlices: Array<MarketCapSlice> = []
	let selectedPeerCount = 0
	let othersValue = 0
	for (const peer of series.peers) {
		if (selectedSeries && !selectedSeries.has(peer.name)) continue
		selectedPeerCount++
		if (visibleSlices.length < limit) visibleSlices.push(peer)
		else othersValue += peer.value
	}
	if (selectedPeerCount === series.peers.length) othersValue += series.upstreamRemainderValue
	if (othersValue > 0) {
		visibleSlices.push({
			name: 'Others',
			value: othersValue,
			color: '#AAAAAA'
		})
	}

	if (series.kind === 'pie') {
		const chartData: Array<{ name: string; value: number }> = []
		const stackColors: Record<string, string> = {}
		for (const slice of visibleSlices) {
			chartData.push({ name: slice.name, value: slice.value })
			stackColors[slice.name] = slice.color
		}
		return { kind: 'pie', chartData, stackColors }
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
