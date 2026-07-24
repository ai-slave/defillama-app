import type { EChartsOption } from 'echarts'
import { TreemapChart as EChartTreemap, type TreemapSeriesOption } from 'echarts/charts'
import { GraphicComponent, ToolboxComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { formatPercentChange, formatUsd } from '~/utils/numberFormat'
import { CHART_INSET } from '../../shared/chartSpacing'
import { getChartTheme } from '../../shared/chartTheme'
import { formatChartValue } from '../../shared/formatters'
import { asTooltipDataRecord } from '../../shared/tooltip'
import { buildWatermarkGraphic } from '../../shared/watermark'
import { clearTreemapFocus, registerTreemapFocusTracking } from '../focus'
import type { MarketTreemapGroup, MarketTreemapLeaf, MarketTreemapNode } from './types'

echarts.use([TooltipComponent, ToolboxComponent, EChartTreemap, CanvasRenderer, GraphicComponent, LabelLayout])

export interface MarketTreemapChartProps {
	treeData: MarketTreemapNode[]
	leaves: MarketTreemapLeaf[]
	sizeLabel: string
	colorLabel: string
	valueSymbol?: string
	height?: string
	showMarketCapRow?: boolean
	groupItemsLabel?: string
	onReady?: (instance: echarts.ECharts | null) => void
}

const LEAF_TEXT_STYLE = {
	color: '#fff'
}

const TREEMAP_SQUARE_RATIO = 0.9
const ZOOM_TO_NODE_RATIO = 0.35

// zrender lays text into cell minus 2x(border+padding) and drops whole lines
// that overflow the box; treemap's default padding of 5 blanks small cells.
const LEAF_LABEL_PADDING = 1
const LEAF_BORDER_WIDTH = 1
const LABEL_BOX_PADDING = (LEAF_LABEL_PADDING + LEAF_BORDER_WIDTH) * 2

const FIT_SLACK = 3

const lineHeightOf = (size: number) => size + 4
const iconLineHeightOf = (size: number) => size + 2

const SCALE_BUCKETS = [
	{ icon: 48, ticker: 18, chg: 15 },
	{ icon: 36, ticker: 15, chg: 12 },
	{ icon: 26, ticker: 12, chg: 10 },
	{ icon: 20, ticker: 10, chg: 9 },
	{ icon: 16, ticker: 9, chg: 9 }
] as const

const ICON_ONLY_BUCKETS = [{ icon: 12 }, { icon: 8 }] as const

type TreemapLabelOption = NonNullable<TreemapSeriesOption['label']>
type TreemapRichTextStyles = NonNullable<TreemapLabelOption['rich']>

type TreemapLayoutAccess = {
	getModel?: () => {
		getSeriesByIndex?: (seriesIndex: number) => {
			getData?: () => {
				getItemLayout?: (dataIndex: number) => { width?: number; height?: number } | undefined
			}
		}
	}
}

interface TreemapLabelLayoutParams {
	rect?: { height: number }
	text?: unknown
}

const TEXT_BUCKETS = SCALE_BUCKETS.map(({ ticker, chg }) => ({ ticker, chg }))

const ICON_SIZES = [...new Set<number>([...SCALE_BUCKETS.map((b) => b.icon), ...ICON_ONLY_BUCKETS.map((b) => b.icon)])]
const TICKER_SIZES = [...new Set<number>(SCALE_BUCKETS.map((b) => b.ticker))]
const CHG_SIZES = [...new Set<number>(SCALE_BUCKETS.map((b) => b.chg))]

const MIN_TEXT_WIDTH = 24

function pickLeafLabel(
	cellWidth: number,
	cellHeight: number,
	name: string,
	changeLabel: string,
	iconOk: boolean
): string {
	if (iconOk) {
		for (const bucket of SCALE_BUCKETS) {
			const fullHeight =
				iconLineHeightOf(bucket.icon) + lineHeightOf(bucket.ticker) + lineHeightOf(bucket.chg) + FIT_SLACK
			if (cellHeight >= fullHeight && cellWidth >= bucket.icon + 10) {
				return [`{icon${bucket.icon}|}`, `{ticker${bucket.ticker}|${name}}`, `{chg${bucket.chg}|${changeLabel}}`].join(
					'\n'
				)
			}
		}
		for (const bucket of SCALE_BUCKETS) {
			if (
				cellHeight >= iconLineHeightOf(bucket.icon) + lineHeightOf(bucket.chg) + FIT_SLACK &&
				cellWidth >= bucket.icon + 8
			) {
				return [`{icon${bucket.icon}|}`, `{chg${bucket.chg}|${changeLabel}}`].join('\n')
			}
		}
		for (const bucket of ICON_ONLY_BUCKETS) {
			if (cellWidth >= bucket.icon && cellHeight >= iconLineHeightOf(bucket.icon)) {
				return `{icon${bucket.icon}|}`
			}
		}
		return ''
	}
	for (const bucket of TEXT_BUCKETS) {
		if (
			cellHeight >= lineHeightOf(bucket.ticker) + lineHeightOf(bucket.chg) + FIT_SLACK &&
			cellWidth >= MIN_TEXT_WIDTH
		) {
			return [`{ticker${bucket.ticker}|${name}}`, `{chg${bucket.chg}|${changeLabel}}`].join('\n')
		}
	}
	for (const bucket of TEXT_BUCKETS) {
		if (cellHeight >= lineHeightOf(bucket.ticker) && cellWidth >= MIN_TEXT_WIDTH) {
			return `{ticker${bucket.ticker}|${name}}`
		}
	}
	return ''
}

const iconImages = new Map<string, HTMLCanvasElement>()
const failedIconUrls = new Set<string>()
const pendingIconUrls = new Set<string>()
const iconSettleCallbacks = new Map<string, Set<() => void>>()
const ICON_CANVAS_SIZE = 96
// One chart renders at most 500 logos. Keep enough transition headroom for a
// metric change without retaining every logo visited during the page session.
const ICON_CACHE_LIMIT = 750

function trimIconCache() {
	while (iconImages.size > ICON_CACHE_LIMIT) {
		let evicted = false
		for (const url of iconImages.keys()) {
			if (pendingIconUrls.has(url)) continue
			iconImages.delete(url)
			evicted = true
			break
		}
		if (!evicted) return
	}
}

function getIconCanvas(url: string): HTMLCanvasElement | undefined {
	const canvas = iconImages.get(url)
	if (!canvas) return
	iconImages.delete(url)
	iconImages.set(url, canvas)
	return canvas
}

function setIconCanvas(url: string, canvas: HTMLCanvasElement) {
	iconImages.set(url, canvas)
	trimIconCache()
}

function markIconFailed(url: string) {
	failedIconUrls.add(url)
	if (failedIconUrls.size <= ICON_CACHE_LIMIT) return
	failedIconUrls.delete(failedIconUrls.values().next().value!)
}

// Hand zrender a per-icon canvas, not the URL: URL strings go through zrender's
// global LRU(50) image cache which thrashes with 500 logos. The canvas also
// lets us clip the logo into a circle (rich text has no border-radius).
function preloadLeafIcon(url: string, onSettled: () => void): HTMLCanvasElement | undefined {
	if (typeof window === 'undefined') return
	if (!url) {
		failedIconUrls.add(url)
		return
	}
	if (failedIconUrls.has(url)) return
	const cached = getIconCanvas(url)
	if (cached) {
		iconSettleCallbacks.get(url)?.add(onSettled)
		return cached
	}
	pendingIconUrls.add(url)
	const callbacks = new Set([onSettled])
	iconSettleCallbacks.set(url, callbacks)
	const canvas = document.createElement('canvas')
	canvas.width = ICON_CANVAS_SIZE
	canvas.height = ICON_CANVAS_SIZE
	setIconCanvas(url, canvas)
	const settle = () => {
		pendingIconUrls.delete(url)
		iconSettleCallbacks.delete(url)
		trimIconCache()
		for (const callback of callbacks) callback()
	}
	const img = new Image()
	img.onload = () => {
		const ctx = canvas.getContext('2d')
		if (ctx) {
			ctx.save()
			ctx.beginPath()
			ctx.arc(ICON_CANVAS_SIZE / 2, ICON_CANVAS_SIZE / 2, ICON_CANVAS_SIZE / 2, 0, Math.PI * 2)
			ctx.closePath()
			ctx.clip()
			ctx.fillStyle = '#fff'
			ctx.fillRect(0, 0, ICON_CANVAS_SIZE, ICON_CANVAS_SIZE)
			ctx.drawImage(img, 0, 0, ICON_CANVAS_SIZE, ICON_CANVAS_SIZE)
			ctx.restore()
		}
		settle()
	}
	img.onerror = () => {
		markIconFailed(url)
		iconImages.delete(url)
		settle()
	}
	img.src = url
	return canvas
}

const LEAF_TEXT_RICH: TreemapRichTextStyles = {}
const LABEL_LINE_HEIGHTS: Record<string, number> = {}
for (const fontSize of TICKER_SIZES) {
	LEAF_TEXT_RICH[`ticker${fontSize}`] = {
		fontSize,
		fontWeight: 600,
		lineHeight: lineHeightOf(fontSize),
		...LEAF_TEXT_STYLE
	}
	LABEL_LINE_HEIGHTS[`ticker${fontSize}`] = lineHeightOf(fontSize)
}
for (const fontSize of CHG_SIZES) {
	LEAF_TEXT_RICH[`chg${fontSize}`] = { fontSize, lineHeight: lineHeightOf(fontSize), ...LEAF_TEXT_STYLE }
	LABEL_LINE_HEIGHTS[`chg${fontSize}`] = lineHeightOf(fontSize)
}
for (const iconSize of ICON_SIZES) LABEL_LINE_HEIGHTS[`icon${iconSize}`] = iconLineHeightOf(iconSize)

function buildLeafIconRich(image: HTMLCanvasElement | undefined) {
	const rich: TreemapRichTextStyles = {}
	for (const iconSize of ICON_SIZES) {
		rich[`icon${iconSize}`] = {
			backgroundColor: { image },
			width: iconSize,
			height: iconSize,
			lineHeight: iconLineHeightOf(iconSize)
		}
	}
	return rich
}

type PreparedMarketTreemapLeaf = MarketTreemapLeaf & {
	label: { padding: number; rich: TreemapRichTextStyles }
}

type PreparedMarketTreemapGroup = Omit<MarketTreemapGroup, 'children'> & {
	children: PreparedMarketTreemapLeaf[]
}

type PreparedMarketTreemapNode = PreparedMarketTreemapLeaf | PreparedMarketTreemapGroup

function prepareLeaf(node: MarketTreemapLeaf, onIconSettled: () => void): PreparedMarketTreemapLeaf {
	const image = preloadLeafIcon(node.iconUrl, onIconSettled)
	return {
		...node,
		label: {
			padding: LEAF_LABEL_PADDING,
			rich: buildLeafIconRich(image)
		}
	}
}

function buildLevels(hasGroups: boolean, isDark: boolean) {
	const groupBorderColor = isDark ? '#2d3139' : '#d1d5db'
	const leafLevel = {
		itemStyle: {
			borderColor: groupBorderColor,
			borderWidth: LEAF_BORDER_WIDTH,
			gapWidth: 1
		}
	}

	if (!hasGroups) {
		return [
			{
				itemStyle: { borderWidth: 0, gapWidth: 1 },
				upperLabel: { show: false }
			},
			leafLevel
		]
	}

	return [
		{
			itemStyle: { borderWidth: 0, gapWidth: 2 },
			upperLabel: { show: false }
		},
		{
			itemStyle: {
				borderColor: groupBorderColor,
				borderWidth: 3,
				gapWidth: 2
			},
			upperLabel: {
				show: true,
				height: 22,
				padding: [0, 4],
				fontWeight: 600,
				color: isDark ? '#fff' : '#1f2937',
				...(isDark ? { backgroundColor: 'rgba(55,65,81,0.88)' } : { backgroundColor: 'rgba(229,231,235,0.92)' })
			}
		},
		leafLevel
	]
}

export default function MarketTreemapChart({
	treeData,
	leaves,
	sizeLabel,
	colorLabel,
	valueSymbol = '$',
	height = '600px',
	showMarketCapRow = true,
	groupItemsLabel = 'Companies',
	onReady
}: MarketTreemapChartProps) {
	const [isDark] = useDarkModeManager()
	const containerRef = useRef<HTMLDivElement | null>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const onReadyRef = useRef(onReady)
	useEffect(() => {
		onReadyRef.current = onReady
	})

	useChartResize(chartRef, containerRef)

	const applyOptionRef = useRef<(() => void) | null>(null)
	const iconRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const scheduleIconRefresh = useCallback(() => {
		if (iconRefreshTimer.current) clearTimeout(iconRefreshTimer.current)
		iconRefreshTimer.current = setTimeout(() => {
			iconRefreshTimer.current = null
			if (pendingIconUrls.size > 0) return
			applyOptionRef.current?.()
		}, 200)
	}, [])
	useEffect(() => {
		return () => {
			if (iconRefreshTimer.current) clearTimeout(iconRefreshTimer.current)
		}
	}, [])

	// Canvas-backed rich text is the only runtime decoration. Keep it stable when
	// the same canonical leaves are merely regrouped.
	const chartLeaves = useMemo(() => {
		const prepared: PreparedMarketTreemapLeaf[] = []
		for (const leaf of leaves) prepared.push(prepareLeaf(leaf, scheduleIconRefresh))
		return prepared
	}, [leaves, scheduleIconRefresh])
	const chartDataTree = useMemo(() => {
		if (treeData === leaves) return chartLeaves
		const prepared: PreparedMarketTreemapNode[] = []
		for (const node of treeData) {
			if ('children' in node) {
				const children: PreparedMarketTreemapLeaf[] = []
				for (const child of node.children) children.push(chartLeaves[child.iconKey])
				prepared.push({ ...node, children })
			} else {
				prepared.push(chartLeaves[node.iconKey])
			}
		}
		return prepared
	}, [chartLeaves, leaves, treeData])
	const hasGroups = treeData.length > 0 && 'children' in treeData[0]

	const formatSizeValue = useMemo(() => (value: number) => formatChartValue(value, valueSymbol), [valueSymbol])

	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const instance = echarts.init(el, null, { renderer: 'canvas' })
		chartRef.current = instance
		onReadyRef.current?.(instance)
		const unregisterTreemapFocus = registerTreemapFocusTracking(instance)

		return () => {
			unregisterTreemapFocus()
			applyOptionRef.current = null
			chartRef.current = null
			onReadyRef.current?.(null)
			instance.dispose()
		}
	}, [])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return
		const option: EChartsOption = {
			graphic: [buildWatermarkGraphic(isDark)],
			tooltip: {
				className: 'defillama-echarts-tooltip',
				backgroundColor: 'transparent',
				borderWidth: 0,
				formatter: function (info) {
					const data = asTooltipDataRecord(info?.data) ?? {}
					const children = Array.isArray(data.children) ? data.children : []
					if (children.length > 0) {
						return [
							`<strong>${info.name}</strong><br>`,
							`${sizeLabel}: ${formatSizeValue(info.value?.[0] ?? 0)}<br>`,
							`${groupItemsLabel}: ${children.length}`
						].join('')
					}
					const companyName = typeof data.companyName === 'string' ? data.companyName : info.name
					const rows = [
						`<strong>${companyName}</strong> (${info.name})<br>`,
						typeof data.sector === 'string' ? `Sector: ${data.sector}<br>` : '',
						typeof data.industry === 'string' ? `Industry: ${data.industry}<br>` : '',
						`${sizeLabel}: ${formatSizeValue(info.value?.[0] ?? 0)}<br>`
					]
					if (typeof data.marketCap === 'number' && showMarketCapRow) {
						rows.push(
							`Market Cap: ${formatUsd(data.marketCap, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}<br>`
						)
					}
					rows.push(`${colorLabel}: ${formatPercentChange(info.value?.[1]) ?? '-'}`)
					return rows.filter(Boolean).join('')
				}
			},
			series: [
				{
					name: 'All',
					type: 'treemap',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					roam: true,
					nodeClick: 'zoomToNode',
					zoomToNodeRatio: ZOOM_TO_NODE_RATIO,
					squareRatio: TREEMAP_SQUARE_RATIO,
					// echarts 6 treemap breadcrumb renders stale paths and wrong widths.
					breadcrumb: { show: false },
					label: {
						position: 'inside',
						rich: LEAF_TEXT_RICH,
						formatter: function (params) {
							const data = asTooltipDataRecord(params?.data) ?? {}
							// upperLabel reuses this formatter; group nodes must return their name.
							if (Array.isArray(data.children) && data.children.length > 0) return String(params.name ?? '')
							// Treemap cell bounds are only exposed through ECharts' private model API.
							const layout = (instance as unknown as TreemapLayoutAccess)
								.getModel?.()
								?.getSeriesByIndex?.(params.seriesIndex ?? 0)
								?.getData?.()
								?.getItemLayout?.(params.dataIndex)
							const cellWidth = (layout?.width ?? 0) - LABEL_BOX_PADDING
							const cellHeight = (layout?.height ?? 0) - LABEL_BOX_PADDING
							const iconOk = typeof data.iconUrl !== 'string' || !failedIconUrls.has(data.iconUrl)
							return pickLeafLabel(
								cellWidth,
								cellHeight,
								params.name ?? '',
								formatPercentChange(params.value?.[1]) ?? '-',
								iconOk
							)
						}
					},
					// Needs the LabelLayout feature in echarts.use or it is silently ignored.
					// Center via dy: treemap pins the box to the full cell; x/y would lag on roam.
					labelLayout: function (params: TreemapLabelLayoutParams) {
						if (typeof params?.text !== 'string' || !params.text.startsWith('{')) return {}
						const rect = params.rect
						if (!rect) return {}
						let contentHeight = 0
						for (const line of params.text.split('\n')) {
							const marker = /^\{((?:icon|ticker|chg)\d+)/.exec(line)
							if (!marker) continue
							contentHeight += LABEL_LINE_HEIGHTS[marker[1]]
						}
						return {
							dy: (rect.height - contentHeight) / 2 - LEAF_LABEL_PADDING
						}
					},
					upperLabel: {
						show: true,
						height: 24,
						color: getChartTheme(isDark).treemapLabel
					},
					itemStyle: {
						borderColor: isDark ? '#2d3139' : '#d1d5db'
					},
					levels: buildLevels(hasGroups, isDark),
					data: chartDataTree
				}
			]
		}
		clearTreemapFocus(instance)
		instance.setOption(option, { notMerge: true })
		applyOptionRef.current = () => {
			if (instance.isDisposed()) return
			// Hide the tooltip before replacing its backing leaf data.
			instance.dispatchAction({ type: 'hideTip' })
			clearTreemapFocus(instance)
			instance.setOption(option, { notMerge: true })
		}

		return () => {
			applyOptionRef.current = null
		}
	}, [chartDataTree, colorLabel, formatSizeValue, groupItemsLabel, hasGroups, isDark, showMarketCapRow, sizeLabel])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		const raf = requestAnimationFrame(() => {
			if (instance.isDisposed()) return
			instance.resize()
		})
		return () => cancelAnimationFrame(raf)
	}, [height])

	return (
		<div className="w-full overflow-hidden" style={{ height, padding: CHART_INSET, boxSizing: 'border-box' }}>
			<div ref={containerRef} className="h-full w-full" />
		</div>
	)
}
