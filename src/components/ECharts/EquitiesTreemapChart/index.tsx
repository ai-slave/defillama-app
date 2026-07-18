import { TreemapChart as EChartTreemap } from 'echarts/charts'
import { GraphicComponent, ToolboxComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type {
	EquitiesTreemapNode,
	IEquitiesTreemapGroup,
	IEquitiesTreemapLeaf
} from '~/containers/Equities/treemapData'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { formattedNum } from '~/utils'
import { equityIconUrl } from '~/utils/icons'
import { CHART_INSET } from '../chartSpacing'
import { getChartTheme } from '../chartTheme'
import { buildWatermarkGraphic } from '../utils'
import { EQUITIES_TREEMAP_COLORS } from './colors'

echarts.use([TooltipComponent, ToolboxComponent, EChartTreemap, CanvasRenderer, GraphicComponent, LabelLayout])

export interface IEquitiesTreemapChartProps {
	treeData: EquitiesTreemapNode[]
	sizeLabel: string
	colorLabel: string
	valueSymbol?: string
	height?: string
	showMarketCapRow?: boolean
	groupItemsLabel?: string
	onReady?: (instance: echarts.ECharts | null) => void
}

function hexToRgb(hex: string): [number, number, number] {
	const normalized = hex.replace('#', '')
	const expanded =
		normalized.length === 3
			? normalized
					.split('')
					.map((c) => c + c)
					.join('')
			: normalized
	return [parseInt(expanded.slice(0, 2), 16), parseInt(expanded.slice(2, 4), 16), parseInt(expanded.slice(4, 6), 16)]
}

function lerpHex(from: string, to: string, t: number): string {
	const a = hexToRgb(from)
	const b = hexToRgb(to)
	const channels = a.map((channel, i) => Math.round(channel + (b[i] - channel) * t))
	return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`
}

const COLOR_CAP_PCT = 3

function changeToColor(pct: number | null | undefined): string {
	if (pct == null || !isFinite(pct) || pct === 0) return EQUITIES_TREEMAP_COLORS.neutral
	const t = Math.min(Math.abs(pct) / COLOR_CAP_PCT, 1)
	return pct > 0
		? lerpHex(EQUITIES_TREEMAP_COLORS.neutral, EQUITIES_TREEMAP_COLORS.positive, t)
		: lerpHex(EQUITIES_TREEMAP_COLORS.negative, EQUITIES_TREEMAP_COLORS.neutral, 1 - t)
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
function preloadLeafIcon(url: string, onSettled: () => void) {
	if (typeof window === 'undefined') return
	if (!url) {
		failedIconUrls.add(url)
		return
	}
	if (failedIconUrls.has(url)) return
	if (getIconCanvas(url)) {
		iconSettleCallbacks.get(url)?.add(onSettled)
		return
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
}

const LEAF_TEXT_RICH: Record<string, any> = {}
for (const fontSize of TICKER_SIZES) {
	LEAF_TEXT_RICH[`ticker${fontSize}`] = {
		fontSize,
		fontWeight: 600,
		lineHeight: lineHeightOf(fontSize),
		...LEAF_TEXT_STYLE
	}
}
for (const fontSize of CHG_SIZES) {
	LEAF_TEXT_RICH[`chg${fontSize}`] = { fontSize, lineHeight: lineHeightOf(fontSize), ...LEAF_TEXT_STYLE }
}

function buildLeafRich(iconUrl: string) {
	const rich: Record<string, any> = { ...LEAF_TEXT_RICH }
	for (const iconSize of ICON_SIZES) {
		rich[`icon${iconSize}`] = {
			backgroundColor: { image: getIconCanvas(iconUrl) as any },
			width: iconSize,
			height: iconSize,
			lineHeight: iconLineHeightOf(iconSize)
		}
	}
	return rich
}

function leafIconUrl(node: Pick<IEquitiesTreemapLeaf, 'name' | 'country' | 'iconUrl'>): string {
	if (typeof node.iconUrl === 'string') return node.iconUrl
	return equityIconUrl(node.name, node.country || 'US')
}

type EquitiesTreemapChartLeaf = IEquitiesTreemapLeaf & {
	itemStyle: { color: string }
	label: { padding: number; rich: Record<string, any> }
}

type EquitiesTreemapChartGroup = Omit<IEquitiesTreemapGroup, 'children'> & {
	children: EquitiesTreemapChartLeaf[]
}

type EquitiesTreemapChartNode = EquitiesTreemapChartLeaf | EquitiesTreemapChartGroup

function prepareLeaf(node: IEquitiesTreemapLeaf, onIconSettled: () => void): EquitiesTreemapChartLeaf {
	const iconUrl = leafIconUrl(node)
	preloadLeafIcon(iconUrl, onIconSettled)
	return {
		...node,
		itemStyle: { color: changeToColor(node.value[1]) },
		label: {
			padding: LEAF_LABEL_PADDING,
			rich: buildLeafRich(iconUrl)
		}
	}
}

function prepareChartData(nodes: EquitiesTreemapNode[], onIconSettled: () => void): EquitiesTreemapChartNode[] {
	const prepared: EquitiesTreemapChartNode[] = []
	for (const node of nodes) {
		if ('children' in node) {
			const children: EquitiesTreemapChartLeaf[] = []
			for (const child of node.children) children.push(prepareLeaf(child, onIconSettled))
			prepared.push({ ...node, children })
		} else {
			prepared.push(prepareLeaf(node, onIconSettled))
		}
	}
	return prepared
}

function formatChangePct(value: number | null | undefined): string {
	if (value == null || !isFinite(value)) return '-'
	return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
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

export default function EquitiesTreemapChart({
	treeData,
	sizeLabel,
	colorLabel,
	valueSymbol = '$',
	height = '600px',
	showMarketCapRow = true,
	groupItemsLabel = 'Companies',
	onReady
}: IEquitiesTreemapChartProps) {
	const [isDark] = useDarkModeManager()
	const containerRef = useRef<HTMLDivElement | null>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const onReadyRef = useRef(onReady)
	useEffect(() => {
		onReadyRef.current = onReady
	})

	useChartResize(chartRef)

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

	const chartDataTree = useMemo(() => {
		return prepareChartData(treeData, scheduleIconRefresh)
	}, [scheduleIconRefresh, treeData])

	const hasGroups = useMemo(() => chartDataTree.some((node) => 'children' in node), [chartDataTree])

	const formatSizeValue = useMemo(
		() => (value: number) => formattedNum(value, valueSymbol.length > 0 ? valueSymbol : false),
		[valueSymbol]
	)

	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const instance = echarts.init(el, null, { renderer: 'canvas' })
		chartRef.current = instance
		onReadyRef.current?.(instance)

		return () => {
			applyOptionRef.current = null
			chartRef.current = null
			onReadyRef.current?.(null)
			instance.dispose()
		}
	}, [])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return
		const option = {
			graphic: [buildWatermarkGraphic(isDark)],
			tooltip: {
				className: 'defillama-echarts-tooltip',
				backgroundColor: 'transparent',
				borderWidth: 0,
				formatter: function (info) {
					const data = info?.data ?? {}
					if (Array.isArray(data.children) && data.children.length > 0) {
						return [
							`<strong>${info.name}</strong><br>`,
							`${sizeLabel}: ${formatSizeValue(info.value?.[0] ?? 0)}<br>`,
							`${groupItemsLabel}: ${data.children.length}`
						].join('')
					}
					const rows = [
						`<strong>${data.companyName ?? info.name}</strong> (${info.name})<br>`,
						data.sector ? `Sector: ${data.sector}<br>` : '',
						data.industry ? `Industry: ${data.industry}<br>` : '',
						`${sizeLabel}: ${formatSizeValue(info.value?.[0] ?? 0)}<br>`
					]
					if (data.marketCap != null && showMarketCapRow) {
						rows.push(`Market Cap: ${formattedNum(data.marketCap, true)}<br>`)
					}
					rows.push(`${colorLabel}: ${formatChangePct(info.value?.[1])}`)
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
						formatter: function (params) {
							const data = params?.data ?? {}
							// upperLabel reuses this formatter; group nodes must return their name.
							if (Array.isArray(data.children) && data.children.length > 0) return String(params.name ?? '')
							const layout = (instance as any)
								.getModel?.()
								?.getSeriesByIndex?.(params.seriesIndex ?? 0)
								?.getData?.()
								?.getItemLayout?.(params.dataIndex)
							const cellWidth = (layout?.width ?? 0) - LABEL_BOX_PADDING
							const cellHeight = (layout?.height ?? 0) - LABEL_BOX_PADDING
							const iconOk = !failedIconUrls.has(leafIconUrl(data))
							return pickLeafLabel(cellWidth, cellHeight, params.name ?? '', formatChangePct(params.value?.[1]), iconOk)
						}
					},
					// Needs the LabelLayout feature in echarts.use or it is silently ignored.
					// Center via dy: treemap pins the box to the full cell; x/y would lag on roam.
					labelLayout: function (params: any) {
						if (typeof params?.text !== 'string' || !params.text.startsWith('{')) return {}
						const rect = params.rect
						if (!rect) return {}
						let contentHeight = 0
						for (const line of params.text.split('\n')) {
							const marker = /^\{(icon|ticker|chg)(\d+)\|/.exec(line)
							if (!marker) continue
							const size = Number(marker[2])
							contentHeight += marker[1] === 'icon' ? iconLineHeightOf(size) : lineHeightOf(size)
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
		instance.setOption(option, { notMerge: true, lazyUpdate: true })
		applyOptionRef.current = () => {
			if (instance.isDisposed()) return
			// hideTip + synchronous setOption: a mousemove between a deferred
			// (lazyUpdate) rebuild and its flush hits echarts with null series data
			// (getDataParams -> getRawIndex of undefined).
			instance.dispatchAction({ type: 'hideTip' })
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
