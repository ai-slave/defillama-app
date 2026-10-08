import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { chartColor, OTHERS_COLOR } from '~/constants/colors'

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

export interface RuntimePieChartTableRow {
	name: string
	value: number
	/** Percentage of every canonical slice, including the upstream remainder. */
	share: number
}

/*
 * A pie is a share view: its slices always add up to the whole. Picked peers get their own slice (up to `limit` in the
 * pie), and everything else, unpicked peers and the upstream remainder included, is one `Others` slice. Nothing picked
 * draws nothing.
 */

/** The picked slices without the top-N fold, then `Others` holding the rest of the whole. */
export function buildRuntimePieChartTableRows({
	series,
	selectedSeries
}: {
	series: RuntimePieChartData
	selectedSeries?: ReadonlySet<string>
}): Array<RuntimePieChartTableRow> {
	let total = Math.max(series.upstreamOthersValue, 0)
	for (const peer of series.peers) total += peer.value
	const toShare = (value: number) => (total > 0 ? (value / total) * 100 : 0)

	const rows: Array<RuntimePieChartTableRow> = []
	let othersValue = Math.max(series.upstreamOthersValue, 0)
	for (const peer of series.peers) {
		if (selectedSeries && !selectedSeries.has(peer.name)) othersValue += peer.value
		else rows.push({ name: peer.name, value: peer.value, share: toShare(peer.value) })
	}
	if (rows.length === 0 && series.peers.length > 0) return rows
	if (othersValue > 0) rows.push({ name: 'Others', value: othersValue, share: toShare(othersValue) })
	return rows
}

/** Export the pie's picked slices without the top-N fold, the same rows as its table view. */
export function buildRuntimePieChartCsvDataset(
	selection: Parameters<typeof buildRuntimePieChartTableRows>[0]
): MultiSeriesChartDataset {
	const source: MultiSeriesChartDataset['source'] = []
	for (const row of buildRuntimePieChartTableRows(selection)) source.push([row.name, row.value])
	return { dimensions: ['Name', 'Value'], source }
}

export function buildRuntimePieChartPresentation({
	series,
	selectedSeries,
	colorIndexByPeer
}: {
	series: RuntimePieChartData
	selectedSeries?: ReadonlySet<string>
	colorIndexByPeer?: ReadonlyMap<string, number>
}) {
	const chartData: Array<{ name: string; value: number }> = []
	const stackColors: Record<string, string> = {}
	let othersValue = Math.max(series.upstreamOthersValue, 0)
	for (let index = 0; index < series.peers.length; index++) {
		const peer = series.peers[index]!
		if ((selectedSeries && !selectedSeries.has(peer.name)) || chartData.length >= series.limit) {
			othersValue += peer.value
			continue
		}
		chartData.push(peer)
		// Others is grey, outside the palette, so a peer keeps its palette colour without a reserved slot.
		stackColors[peer.name] = chartColor(colorIndexByPeer?.get(peer.name) ?? index)
	}
	if (chartData.length === 0 && series.peers.length > 0) return { chartData, stackColors }
	if (othersValue > 0) {
		chartData.push({ name: 'Others', value: othersValue })
		stackColors.Others = OTHERS_COLOR
	}
	return { chartData, stackColors }
}

/**
 * Pixel layout for a pie beside a right-side legend: the pie centers in the width the legend leaves, and
 * the watermark sits on that center, shrunk to fit small pies. Without a reserved legend the pie centers
 * in the whole canvas.
 */
export function buildPieLayoutOption({
	width,
	height,
	reservedRight,
	centerY,
	showLegend,
	isSmall,
	canvasWatermarkEnabled,
	isDark
}: {
	width: number
	height: number
	reservedRight: number
	centerY: string
	showLegend: boolean
	isSmall: boolean
	canvasWatermarkEnabled: boolean
	isDark: boolean
}) {
	const availableW = Math.max(1, width - reservedRight)
	const cx = Math.round(availableW / 2)
	const cy = Math.round((Number.parseFloat(centerY) / 100) * height)
	const minDim = Math.max(1, Math.min(height, width - reservedRight))
	let watermarkHeight = 40
	let watermarkWidth = Math.round(watermarkHeight * (389 / 133))
	const maxWidth = minDim * 0.6
	if (watermarkWidth > maxWidth) {
		const scale = maxWidth / watermarkWidth
		watermarkWidth = Math.round(watermarkWidth * scale)
		watermarkHeight = Math.max(20, Math.round(watermarkHeight * scale))
	}

	return {
		series: {
			center: !showLegend || isSmall || reservedRight <= 0 ? ['50%', centerY] : [cx, centerY]
		},
		...(canvasWatermarkEnabled
			? {
					graphic: [
						{
							id: 'defillama-watermark',
							type: 'image' as const,
							zlevel: 10,
							z: 999,
							silent: true,
							left: Math.round(cx - watermarkWidth / 2),
							top: Math.round(cy - watermarkHeight / 2),
							style: {
								image: isDark ? '/assets/defillama-light-neutral.webp' : '/assets/defillama-dark-neutral.webp',
								width: watermarkWidth,
								height: watermarkHeight,
								opacity: 0.3
							}
						}
					]
				}
			: {})
	}
}
