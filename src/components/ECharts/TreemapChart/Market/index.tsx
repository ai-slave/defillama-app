import type { ComposeOption, GraphicComponentOption, ToolboxComponentOption, TooltipComponentOption } from 'echarts'
import { TreemapChart as EChartTreemap, type TreemapSeriesOption } from 'echarts/charts'
import { GraphicComponent, ToolboxComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useEffectEvent, useMemo, useRef } from 'react'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import { TreemapLabelContrast } from '~/components/ECharts/TreemapChart/labelContrast'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { useStableCallback } from '~/hooks/useStableCallback'
import { changeTone, formatChange } from '~/ui/Change'
import { formatPercentChange, formatUsd } from '~/utils/numberFormat'
import { CHART_INSET } from '../../shared/chartSpacing'
import { formatChartValue } from '../../shared/formatters'
import { asTooltipDataRecord, normalizeTooltipItems } from '../../shared/tooltip'
import { buildWatermarkGraphic } from '../../shared/watermark'
import { clearTreemapFocus, registerTreemapFocusTracking } from '../focus'
import {
	CHG_SIZES,
	centerLeafLabel,
	ICON_SIZES,
	iconLineHeightOf,
	LABEL_BOX_PADDING,
	LEAF_BORDER_WIDTH,
	LEAF_LABEL_PADDING,
	lineHeightOf,
	pickLeafLabel,
	TICKER_SIZES
} from './leafLabel'
import type { MarketTreemapGroup, MarketTreemapLeaf, MarketTreemapNode } from './types'

echarts.use([
	TreemapLabelContrast,
	TooltipComponent,
	ToolboxComponent,
	EChartTreemap,
	CanvasRenderer,
	GraphicComponent,
	LabelLayout
])

export interface MarketTreemapChartProps {
	treeData: Array<MarketTreemapNode>
	leaves: Array<MarketTreemapLeaf>
	sizeLabel: string
	colorLabel: string
	valueSymbol?: string
	/** A fixed height. Left out, the chart fills its slot from a 360px floor (README → Size). */
	height?: string
	showMarketCapRow?: boolean
	groupItemsLabel?: string
	onReady?: (instance: echarts.ECharts | null) => void
}

const TREEMAP_SQUARE_RATIO = 0.9
const ZOOM_TO_NODE_RATIO = 0.35

type TreemapLabelOption = NonNullable<TreemapSeriesOption['label']>
type TreemapRichTextStyles = NonNullable<TreemapLabelOption['rich']>

type TreemapLayoutModel = {
	getSeriesByIndex?: (seriesIndex: number) => {
		getData?: () => {
			getItemLayout?: (dataIndex: number) => { width?: number; height?: number } | undefined
		}
	}
}

type TreemapLayoutAccess = {
	getModel: () => TreemapLayoutModel | undefined
}

function hasTreemapLayoutAccess(value: object): value is TreemapLayoutAccess {
	return 'getModel' in value && typeof value.getModel === 'function'
}

interface TreemapLabelLayoutParams {
	rect?: { height: number }
	text?: unknown
}

function readPercentChange(values: Array<unknown>): number | null | undefined {
	const value = values[1]
	if (value === null) return null
	return typeof value === 'number' ? value : undefined
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
	img.addEventListener(
		'load',
		() => {
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
		},
		{ once: true }
	)
	img.addEventListener(
		'error',
		() => {
			markIconFailed(url)
			iconImages.delete(url)
			settle()
		},
		{ once: true }
	)
	img.src = url
	return canvas
}

const LEAF_TEXT_RICH: TreemapRichTextStyles = {}
for (const fontSize of TICKER_SIZES) {
	LEAF_TEXT_RICH[`ticker${fontSize}`] = {
		fontSize,
		fontWeight: 600,
		lineHeight: lineHeightOf(fontSize)
	}
}
for (const fontSize of CHG_SIZES) {
	LEAF_TEXT_RICH[`chg${fontSize}`] = { fontSize, lineHeight: lineHeightOf(fontSize) }
}

function buildLeafIconRich(image: HTMLCanvasElement | undefined) {
	const rich: TreemapRichTextStyles = {}
	for (const iconSize of ICON_SIZES) {
		const textStyle = {
			width: iconSize,
			height: iconSize,
			lineHeight: iconLineHeightOf(iconSize)
		}
		rich[`icon${iconSize}`] = image === undefined ? textStyle : { ...textStyle, backgroundColor: { image } }
	}
	return rich
}

type PreparedMarketTreemapLeaf = MarketTreemapLeaf & {
	label: { padding: number; rich: TreemapRichTextStyles }
}

type PreparedMarketTreemapGroup = Omit<MarketTreemapGroup, 'children'> & {
	children: Array<PreparedMarketTreemapLeaf>
}

type PreparedMarketTreemapNode = PreparedMarketTreemapLeaf | PreparedMarketTreemapGroup
type MarketTreemapSeriesOption = Omit<TreemapSeriesOption, 'data'> & { data: Array<PreparedMarketTreemapNode> }
type MarketTreemapOption = ComposeOption<
	MarketTreemapSeriesOption | GraphicComponentOption | ToolboxComponentOption | TooltipComponentOption
>

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
	height,
	showMarketCapRow = true,
	groupItemsLabel = 'Companies',
	onReady
}: MarketTreemapChartProps) {
	const [isDark] = useDarkModeManager()
	const containerRef = useRef<HTMLDivElement | null>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const emitReady = useEffectEvent((instance: echarts.ECharts | null) => {
		onReady?.(instance)
	})

	useChartResize(chartRef, containerRef)

	const applyOptionRef = useRef<(() => void) | null>(null)
	const iconRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	// Stable rather than a plain useCallback: prepareLeaf receives this during render, and the compiler
	// rejects a render-phase hand-off of any function it can see reading a ref. Only image load events
	// call it, never render.
	const scheduleIconRefresh = useStableCallback(() => {
		if (iconRefreshTimer.current) clearTimeout(iconRefreshTimer.current)
		iconRefreshTimer.current = setTimeout(() => {
			iconRefreshTimer.current = null
			if (pendingIconUrls.size > 0) return
			applyOptionRef.current?.()
		}, 200)
	})
	useEffect(() => {
		return () => {
			if (iconRefreshTimer.current) clearTimeout(iconRefreshTimer.current)
		}
	}, [])

	// Canvas-backed rich text is the only runtime decoration. Keep it stable when
	// the same canonical leaves are merely regrouped.
	const preparedLeaves = useMemo(() => {
		const ordered: Array<PreparedMarketTreemapLeaf> = []
		const byIconKey = new Map<number, PreparedMarketTreemapLeaf>()
		for (const leaf of leaves) {
			if (byIconKey.has(leaf.iconKey)) throw new Error(`Duplicate market treemap icon key ${leaf.iconKey}`)
			const prepared = prepareLeaf(leaf, scheduleIconRefresh)
			ordered.push(prepared)
			byIconKey.set(leaf.iconKey, prepared)
		}
		return { ordered, byIconKey }
	}, [leaves, scheduleIconRefresh])
	const chartDataTree = useMemo(() => {
		if (treeData === leaves) return preparedLeaves.ordered
		const prepared: Array<PreparedMarketTreemapNode> = []
		for (const node of treeData) {
			if ('children' in node) {
				const children: Array<PreparedMarketTreemapLeaf> = []
				for (const child of node.children) {
					const preparedChild = preparedLeaves.byIconKey.get(child.iconKey)
					if (!preparedChild) throw new Error(`Unknown market treemap icon key ${child.iconKey}`)
					children.push(preparedChild)
				}
				prepared.push({ ...node, children })
			} else {
				const preparedLeaf = preparedLeaves.byIconKey.get(node.iconKey)
				if (!preparedLeaf) throw new Error(`Unknown market treemap icon key ${node.iconKey}`)
				prepared.push(preparedLeaf)
			}
		}
		return prepared
	}, [leaves, preparedLeaves, treeData])
	const firstTreeNode = treeData[0]
	const hasGroups = firstTreeNode !== undefined && 'children' in firstTreeNode

	const formatSizeValue = useMemo(() => (value: number) => formatChartValue(value, valueSymbol), [valueSymbol])

	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const instance = echarts.init(el, null, { renderer: 'canvas' })
		chartRef.current = instance
		emitReady(instance)
		const unregisterTreemapFocus = registerTreemapFocusTracking(instance)

		return () => {
			unregisterTreemapFocus()
			applyOptionRef.current = null
			chartRef.current = null
			emitReady(null)
			instance.dispose()
		}
	}, [])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return
		const option: MarketTreemapOption = {
			graphic: [buildWatermarkGraphic(isDark)],
			tooltip: {
				className: 'defillama-echarts-tooltip',
				backgroundColor: 'transparent',
				borderWidth: 0,
				formatter: (rawInfo: unknown) => {
					const info = normalizeTooltipItems(rawInfo)[0]
					if (!info) return ''
					const values = Array.isArray(info.value) ? info.value : []
					const data = asTooltipDataRecord(info.data) ?? {}
					const children = Array.isArray(data.children) ? data.children : []
					if (children.length > 0) {
						return [
							`<strong>${escapeHtml(info.name ?? '')}</strong><br>`,
							`${sizeLabel}: ${formatSizeValue(Number(values[0] ?? 0))}<br>`,
							`${groupItemsLabel}: ${children.length}`
						].join('')
					}
					const companyName = typeof data.companyName === 'string' ? data.companyName : (info.name ?? '')
					const rows = [
						`<strong>${escapeHtml(companyName)}</strong> (${escapeHtml(info.name ?? '')})<br>`,
						typeof data.sector === 'string' ? `Sector: ${escapeHtml(data.sector)}<br>` : '',
						typeof data.industry === 'string' ? `Industry: ${escapeHtml(data.industry)}<br>` : '',
						`${sizeLabel}: ${formatSizeValue(Number(values[0] ?? 0))}<br>`
					]
					if (typeof data.marketCap === 'number' && showMarketCapRow) {
						rows.push(
							`Market Cap: ${formatUsd(data.marketCap, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}<br>`
						)
					}
					const change = readPercentChange(values)
					rows.push(
						`${colorLabel}: ${change == null ? '-' : `<span class="${changeTone(change)}">${formatChange(change)}</span>`}`
					)
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
						formatter: (rawParams: unknown) => {
							const params = normalizeTooltipItems(rawParams)[0]
							if (!params) return ''
							const values = Array.isArray(params.value) ? params.value : []
							const data = asTooltipDataRecord(params.data) ?? {}
							// upperLabel reuses this formatter; group nodes must return their name.
							if (Array.isArray(data.children) && data.children.length > 0) return String(params.name ?? '')
							if (typeof params.dataIndex !== 'number') return ''
							// Treemap cell bounds are only exposed through ECharts' private model API.
							const privateApi: object = instance
							if (!hasTreemapLayoutAccess(privateApi)) return ''
							const layout = privateApi
								.getModel()
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
								formatPercentChange(readPercentChange(values)) ?? '-',
								iconOk
							)
						}
					},
					// Needs the LabelLayout feature in echarts.use or it is silently ignored.
					// Center via dy: treemap pins the box to the full cell; x/y would lag on roam.
					labelLayout(params: TreemapLabelLayoutParams) {
						if (typeof params?.text !== 'string' || !params.rect) return {}
						return centerLeafLabel(params.text, params.rect.height)
					},
					upperLabel: {
						show: true,
						height: 24
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

	return (
		<div
			className={
				height ? 'w-full overflow-hidden' : 'flex w-full flex-1 flex-col overflow-hidden initial:min-h-[360px]'
			}
			style={{ height, padding: CHART_INSET, boxSizing: 'border-box' }}
		>
			<div ref={containerRef} className={height ? 'h-full w-full' : 'flex-1'} />
		</div>
	)
}
