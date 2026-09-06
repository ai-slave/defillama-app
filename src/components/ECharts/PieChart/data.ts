import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_COLORS } from '~/constants/colors'

type PieInputRow = Record<string, unknown>
type RuntimePieInput = Record<string, number> | Array<PieInputRow> | ReadonlyMap<string, number>

function isPieInputMap(data: RuntimePieInput): data is ReadonlyMap<string, number> {
	return data instanceof Map
}

export interface RuntimePieChartData {
	peers: Array<{ name: string; value: number }>
	limit: number
	upstreamOthersValue: number
}

/** Export canonical slices without applying top-N or interactive legend selection. */
export function buildRuntimePieChartCsvDataset(series: RuntimePieChartData): MultiSeriesChartDataset {
	const source: MultiSeriesChartDataset['source'] = []
	for (const peer of series.peers) source.push([peer.name, peer.value])
	if (series.upstreamOthersValue > 0) source.push(['Others', series.upstreamOthersValue])
	return { dimensions: ['Name', 'Value'], source }
}

/** Normalize and rank pie slices, folding the tail and any explicit remainder into `Others`. */
export function preparePieChartData({
	data,
	sliceIdentifier = 'name',
	sliceValue = 'value',
	limit
}: {
	data: Record<string, number> | Array<PieInputRow>
	sliceIdentifier?: string
	sliceValue?: string
	limit?: number
}) {
	const pieData: Array<{ name: string; value: number }> = []
	if (Array.isArray(data)) {
		for (const entry of data) {
			const name = Object.hasOwn(entry, sliceIdentifier) ? entry[sliceIdentifier] : undefined
			const value = Object.hasOwn(entry, sliceValue) ? entry[sliceValue] : undefined
			pieData.push({ name: String(name), value: Number(value) })
		}
	} else {
		for (const name in data) {
			if (Object.hasOwn(data, name)) pieData.push({ name, value: Number(data[name]) })
		}
	}

	pieData.sort((a, b) => b.value - a.value)
	if (!limit) return pieData

	const mainSlices: Array<{ name: string; value: number }> = []
	let othersValue = 0
	for (let i = 0; i < pieData.length; i++) {
		const slice = pieData[i]!
		if (i < limit && slice.name !== 'Others') mainSlices.push(slice)
		else othersValue += slice.value
	}
	if (othersValue > 0) mainSlices.push({ name: 'Others', value: othersValue })
	return mainSlices
}

/** Prepare canonical additive peers for a runtime-filtered pie capped at presentation time. */
export function prepareRuntimePieChartData({
	data,
	limit,
	sliceIdentifier = 'name',
	sliceValue = 'value',
	comparePeers
}: {
	data: RuntimePieInput
	limit: number
	sliceIdentifier?: string
	sliceValue?: string
	comparePeers?: (left: { name: string; value: number }, right: { name: string; value: number }) => number
}): RuntimePieChartData {
	const peers: Array<{ name: string; value: number }> = []
	let upstreamOthersValue = 0
	if (isPieInputMap(data)) {
		for (const [name, value] of data) {
			if (name === 'Others') upstreamOthersValue += value
			else if (value > 0) peers.push({ name, value })
		}
	} else if (Array.isArray(data)) {
		const valueByPeer = new Map<string, number>()
		for (const entry of data) {
			const name = String(entry[sliceIdentifier])
			const value = Number(entry[sliceValue])
			if (name === 'Others') upstreamOthersValue += value
			else valueByPeer.set(name, (valueByPeer.get(name) ?? 0) + value)
		}
		for (const [name, value] of valueByPeer) {
			if (value > 0) peers.push({ name, value })
		}
	} else {
		for (const name in data) {
			const value = data[name]
			if (value === undefined) continue
			if (name === 'Others') upstreamOthersValue += value
			else if (value > 0) peers.push({ name, value })
		}
	}
	peers.sort(comparePeers ?? ((left, right) => right.value - left.value))
	return { peers, limit, upstreamOthersValue }
}

export function buildRuntimePieChartPresentation({
	series,
	selectedSeries,
	colorIndexByPeer,
	includeUpstreamOthers = true
}: {
	series: RuntimePieChartData
	selectedSeries?: ReadonlySet<string>
	colorIndexByPeer?: ReadonlyMap<string, number>
	includeUpstreamOthers?: boolean
}) {
	const chartData: Array<{ name: string; value: number }> = []
	const stackColors: Record<string, string> = {}
	let selectedPeerCount = 0
	let othersValue = 0
	for (let index = 0; index < series.peers.length; index++) {
		const peer = series.peers[index]!
		if (selectedSeries && !selectedSeries.has(peer.name)) continue
		selectedPeerCount++
		if (chartData.length < series.limit) {
			chartData.push(peer)
			const canonicalIndex = colorIndexByPeer?.get(peer.name) ?? index
			const reservedColorIndex = series.limit % CHART_COLORS.length
			const colorIndexBeforeReservedSlot = canonicalIndex % (CHART_COLORS.length - 1)
			const colorIndex =
				colorIndexBeforeReservedSlot < reservedColorIndex
					? colorIndexBeforeReservedSlot
					: colorIndexBeforeReservedSlot + 1
			stackColors[peer.name] = CHART_COLORS[colorIndex % CHART_COLORS.length]!
		} else othersValue += peer.value
	}
	if (includeUpstreamOthers && selectedPeerCount === series.peers.length) othersValue += series.upstreamOthersValue
	if (othersValue > 0) {
		chartData.push({ name: 'Others', value: othersValue })
		stackColors.Others = CHART_COLORS[series.limit % CHART_COLORS.length]!
	}
	return { chartData, stackColors }
}
