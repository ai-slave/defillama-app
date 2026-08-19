import * as Ariakit from '@ariakit/react'
import type {
	DefaultLabelFormatterCallbackParams,
	EChartsOption,
	SeriesOption,
	TitleComponentOption,
	XAXisComponentOption,
	YAXisComponentOption
} from 'echarts'
import type { PieSeriesOption, TreemapSeriesOption } from 'echarts/charts'
import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { getChartLogoMetadata, type ChartLogoMetadata } from '~/components/ECharts/shared/chartLogoMetadata'
import { getChartTheme } from '~/components/ECharts/shared/chartTheme'
import { mergeDeep } from '~/components/ECharts/shared/merge'
import { formatTreemapUsd } from '~/components/ECharts/TreemapChart/formatters'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import {
	menuSurfaceStyles,
	popoverMenuItemStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'
import type { CsvCell } from '~/utils/csvCell'
import { downloadCSV, downloadDataURL } from '~/utils/download'
import { formatPercent } from '~/utils/numberFormat'
import { getChartExportIconFetchUrl } from './chartPngExportIcon'
import {
	BASE_TOP_PADDING,
	computeExportLayout,
	EXPORT_FONT_SIZE,
	IMAGE_EXPORT_WIDTH,
	LEGEND_ITEM_GAP,
	type ExportLayout
} from './chartPngExportLayout'

// --- Shared profile type (single source of truth) ---

export type PngExportProfile = 'default' | 'scatterWithImageSymbols' | 'treemap' | 'treemapNormalized' | 'hbar'

// --- Constants ---

const IMAGE_EXPORT_HEIGHT = 720
const TREEMAP_EXPORT_SIDE_PADDING = 16
const TREEMAP_EXPORT_BOTTOM_PADDING = 16
const TREEMAP_EXPORT_LABEL_Z = 10000
const EXPORT_TITLE_Z = 10002

type TreemapLabelOption = NonNullable<TreemapSeriesOption['label']>
type TreemapSeriesLevelOption = NonNullable<TreemapSeriesOption['levels']>[number]
type TreemapDataItem = NonNullable<TreemapSeriesOption['data']>[number]
type TreemapExportLabelOption = Omit<TreemapLabelOption, 'formatter' | 'show'> & {
	formatter: (params: DefaultLabelFormatterCallbackParams) => string
	show: boolean
}

// --- Small utilities ---

const parsePixelValue = (value: unknown) => {
	if (typeof value === 'number' && Number.isFinite(value)) return value
	if (typeof value === 'string') {
		const trimmed = value.trim()
		if (trimmed.endsWith('px')) {
			const parsed = Number.parseFloat(trimmed.slice(0, -2))
			if (Number.isFinite(parsed)) return parsed
		}
	}
	return null
}

function getSeriesOptions(options: EChartsOption): SeriesOption[] {
	if (!options.series) return []
	return Array.isArray(options.series) ? options.series : [options.series]
}

const hasSeriesType = (options: EChartsOption, type: SeriesOption['type']) =>
	getSeriesOptions(options).some((series) => series.type === type)

type Rect = { x: number; y: number; width: number; height: number }

export type TreemapViewportExportState =
	| {
			actionType: 'treemapZoomToNode' | 'treemapRootToNode'
			targetNodeId?: string
			targetNodePath?: string[]
			targetNodeIndexPath?: number[]
	  }
	| { rootRect: Rect; sourceLayout: { width: number; height: number } }

function getTreemapNumericValue(rawValue: unknown): number {
	const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
	const numeric = typeof value === 'number' ? value : Number(value ?? 0)
	return Number.isFinite(numeric) ? numeric : 0
}

function formatTreemapExportLabel(
	params: DefaultLabelFormatterCallbackParams,
	total: number,
	sourceFormatter: TreemapLabelOption['formatter']
): string {
	if (typeof sourceFormatter === 'function') {
		const label = sourceFormatter(params)
		if (label != null && label !== '') return String(label)
	}

	const rawValue = getTreemapNumericValue(params?.value)
	const pct = formatPercent(total > 0 ? rawValue / total : 0, {
		input: 'fraction',
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	})
	return `{name|${String(params?.name ?? '')}}\n{value|${formatTreemapUsd(rawValue)} (${pct})}`
}

export function sanitizeRichImagesForExport(rich: any) {
	if (!rich || typeof rich !== 'object') return rich
	let sanitized = rich

	for (const key in rich) {
		const style = rich[key]
		const backgroundColor = style?.backgroundColor
		const image = backgroundColor?.image
		if (typeof image?.toDataURL !== 'function') continue

		let dataUrl: string | undefined
		try {
			dataUrl = image.toDataURL('image/png')
		} catch {
			// Cross-origin logos taint their source canvas. Keep the text label exportable without that image.
		}

		if (sanitized === rich) sanitized = { ...rich }
		sanitized[key] = {
			...style,
			backgroundColor: dataUrl ? { ...backgroundColor, image: dataUrl } : undefined
		}
	}

	return sanitized
}

function applyTreemapDataExportLabels(
	data: TreemapDataItem[],
	label: TreemapExportLabelOption,
	upperLabel: TreemapExportLabelOption
): TreemapDataItem[] {
	return data.map((item) => {
		const itemLabel = item.label ?? {}
		const itemUpperLabel = item.upperLabel ?? {}
		return {
			...item,
			label: {
				...label,
				...itemLabel,
				show: true,
				rich: sanitizeRichImagesForExport(itemLabel.rich ?? label.rich),
				formatter: typeof itemLabel.formatter === 'function' ? itemLabel.formatter : label.formatter
			},
			upperLabel: {
				...upperLabel,
				...itemUpperLabel,
				show: itemUpperLabel.show ?? upperLabel.show,
				rich: sanitizeRichImagesForExport(itemUpperLabel.rich ?? upperLabel.rich),
				formatter: typeof itemUpperLabel.formatter === 'function' ? itemUpperLabel.formatter : upperLabel.formatter
			},
			...(item.children ? { children: applyTreemapDataExportLabels(item.children, label, upperLabel) } : {})
		}
	})
}

function stripRichText(value: string): string {
	return value.replace(/\{[^|{}]+\|([^{}]*)\}/g, '$1')
}

function findTreemapDataNodeByPath(
	data: TreemapDataItem[],
	path: string[],
	seriesName: TreemapSeriesOption['name']
): TreemapDataItem | null {
	if (path.length === 0) return null
	const startIndex = seriesName && path[0] === seriesName ? 1 : 0
	let nodes = data
	let match: TreemapDataItem | null = null

	for (let i = startIndex; i < path.length; i++) {
		const segment = path[i]
		if (segment === undefined) return null
		match = null
		for (const node of nodes) {
			if (node.name === segment) {
				match = node
				break
			}
		}
		if (!match) return null
		nodes = match.children ?? []
	}

	return match
}

function findTreemapDataNodeByIndexPath(data: TreemapDataItem[], indexPath: number[]): TreemapDataItem | null {
	let nodes = data
	let match: TreemapDataItem | null = null
	for (const index of indexPath) {
		match = nodes[index] ?? null
		if (!match) return null
		nodes = match.children ?? []
	}
	return match
}

export function getTreemapTargetDataRoot(series: TreemapSeriesOption, state: TreemapViewportExportState | null) {
	if (!state || !('actionType' in state)) return null
	if (!series.data) return null

	const target =
		state.targetNodeIndexPath && state.targetNodeIndexPath.length > 0
			? findTreemapDataNodeByIndexPath(series.data, state.targetNodeIndexPath)
			: state.targetNodePath && state.targetNodePath.length > 0
				? findTreemapDataNodeByPath(series.data, state.targetNodePath, series.name)
				: null
	if (!target) return null
	const { children: _children, ...targetWithoutChildren } = target

	return {
		name: typeof target.name === 'string' && target.name ? target.name : series.name,
		data: target.children && target.children.length > 0 ? target.children : [targetWithoutChildren]
	}
}

function getTreemapNodePath(node: any): string[] {
	const ancestors = node?.getAncestors?.(true)
	if (!Array.isArray(ancestors)) return []
	const path: string[] = []
	for (const ancestor of ancestors) {
		const name = ancestor?.name
		if (typeof name === 'string' && name) path.push(name)
	}
	return path
}

function getTreemapNodeIndexPath(node: any): number[] {
	const ancestors = node?.getAncestors?.(true)
	if (!Array.isArray(ancestors)) return []
	const indexPath: number[] = []
	for (let index = 1; index < ancestors.length; index++) {
		const childIndex = ancestors[index]?.getChildIndex?.()
		if (typeof childIndex !== 'number' || childIndex < 0) return []
		indexPath.push(childIndex)
	}
	return indexPath
}

function getStashedTreemapTarget(chart: echarts.ECharts): TreemapViewportExportState | null {
	const target = (chart as any).__llamaTreemapFocusNode
	if (target && typeof target === 'object') {
		const targetNodeId = typeof target.id === 'string' && target.id ? target.id : undefined
		const targetNodePath = Array.isArray(target.path) ? target.path.filter((item: any) => typeof item === 'string') : []
		const targetNodeIndexPath = Array.isArray(target.indexPath)
			? target.indexPath.filter((item: any) => Number.isInteger(item) && item >= 0)
			: []
		if (targetNodeId || targetNodePath.length > 0 || targetNodeIndexPath.length > 0) {
			return {
				actionType: 'treemapZoomToNode',
				...(targetNodeId ? { targetNodeId } : {}),
				...(targetNodePath.length > 0 ? { targetNodePath } : {}),
				...(targetNodeIndexPath.length > 0 ? { targetNodeIndexPath } : {})
			}
		}
	}

	const legacyTargetNodeId = (chart as any).__llamaTreemapFocusNodeId
	return typeof legacyTargetNodeId === 'string' && legacyTargetNodeId
		? { actionType: 'treemapZoomToNode', targetNodeId: legacyTargetNodeId }
		: null
}

// --- Series flags ---

interface SeriesFlags {
	isSankeyChart: boolean
	isPieChart: boolean
	isTreemapChart: boolean
	isScatterChart: boolean
	isHorizontalBarChart: boolean
	yAxisConfig: YAXisComponentOption | undefined
}

function detectSeriesFlags(options: EChartsOption): SeriesFlags {
	const yAxisConfig = Array.isArray(options.yAxis) ? options.yAxis[0] : options.yAxis
	return {
		isSankeyChart: hasSeriesType(options, 'sankey'),
		isPieChart: hasSeriesType(options, 'pie'),
		isTreemapChart: hasSeriesType(options, 'treemap'),
		isScatterChart: hasSeriesType(options, 'scatter'),
		isHorizontalBarChart: hasSeriesType(options, 'bar') && yAxisConfig?.type === 'category',
		yAxisConfig
	}
}

function getTreemapSeriesModel(chart: echarts.ECharts): any {
	const model = (chart as any).getModel?.()
	const series = model?.getSeriesByType?.('treemap')
	return Array.isArray(series) ? series[0] : undefined
}

function resolveTreemapTargetNodeId(seriesModel: any, state: TreemapViewportExportState): string | null {
	if (!('actionType' in state)) return null

	const root = seriesModel?.getData?.()?.tree?.root
	if (!root) return state.targetNodeId ?? null

	if (state.targetNodeId && root.getNodeById?.(state.targetNodeId)) return state.targetNodeId
	if (state.targetNodeIndexPath && state.targetNodeIndexPath.length > 0) {
		let target = root
		for (const index of state.targetNodeIndexPath) {
			target = target?.children?.[index]
			if (!target) break
		}
		const id = target?.getId?.()
		if (typeof id === 'string' && id) return id
	}

	if (!state.targetNodePath || state.targetNodePath.length === 0) return null

	let resolvedId: string | null = null
	root.eachNode?.((node: any) => {
		const path = getTreemapNodePath(node)
		if (path.length !== state.targetNodePath?.length) return
		for (let i = 0; i < path.length; i++) {
			if (path[i] !== state.targetNodePath[i]) return
		}
		const id = node.getId?.()
		if (typeof id === 'string' && id) resolvedId = id
		return true
	})

	return resolvedId
}

function getFiniteRect(value: any): Rect | null {
	const x = Number(value?.x ?? 0)
	const y = Number(value?.y ?? 0)
	const width = Number(value?.width)
	const height = Number(value?.height)
	if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) return null
	if (width <= 0 || height <= 0) return null
	return { x, y, width, height }
}

export function readTreemapViewportExportState(chart: echarts.ECharts): TreemapViewportExportState | null {
	// Treemap export goals:
	// 1. Always export from the fixed 1280x720 clone so PNG size/aspect do not depend on browser width.
	// 2. Preserve the user's current zoom/drill target by transferring treemap state, not by screenshotting the live canvas.
	// 3. Keep the root/default view as the standard full treemap export.
	// 4. Keep labels visible in the exported PNG; normalized sizing is not useful if labels disappear.
	// 5. Reserve export gutters/title space and mask zoom overflow, because ECharts treemap does not clip to its box.
	const seriesModel = getTreemapSeriesModel(chart)
	if (!seriesModel) return null

	const clickedNode = getStashedTreemapTarget(chart)
	if (clickedNode) return clickedNode

	const viewRoot = seriesModel.getViewRoot?.()
	const rawRoot = seriesModel.getData?.()?.tree?.root
	const viewRootId = viewRoot && viewRoot !== rawRoot ? viewRoot.getId?.() : undefined
	const viewRootPath = viewRoot && viewRoot !== rawRoot ? getTreemapNodePath(viewRoot) : []
	const viewRootIndexPath = viewRoot && viewRoot !== rawRoot ? getTreemapNodeIndexPath(viewRoot) : []
	if (typeof viewRootId === 'string' && viewRootId) {
		return {
			actionType: 'treemapRootToNode',
			targetNodeId: viewRootId,
			...(viewRootPath.length > 0 ? { targetNodePath: viewRootPath } : {}),
			...(viewRootIndexPath.length > 0 ? { targetNodeIndexPath: viewRootIndexPath } : {})
		}
	}

	const layoutInfo = seriesModel?.layoutInfo
	const sourceWidth = Number(layoutInfo?.width)
	const sourceHeight = Number(layoutInfo?.height)
	if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
		return null
	}

	const root = seriesModel?.getData?.()?.tree?.root
	const rootRect = getFiniteRect(root?.getLayout?.())
	if (!rootRect) return null

	const isDefaultView =
		Math.abs(rootRect.x) <= 1 &&
		Math.abs(rootRect.y) <= 1 &&
		Math.abs(rootRect.width - sourceWidth) <= 1 &&
		Math.abs(rootRect.height - sourceHeight) <= 1
	if (isDefaultView) return null

	return {
		rootRect,
		sourceLayout: { width: sourceWidth, height: sourceHeight }
	}
}

export function applyTreemapViewportExportState(chart: echarts.ECharts, state: TreemapViewportExportState): boolean {
	const seriesModel = getTreemapSeriesModel(chart)
	if (!seriesModel) return false

	if ('actionType' in state) {
		const targetNodeId = resolveTreemapTargetNodeId(seriesModel, state)
		if (!targetNodeId) return false
		chart.dispatchAction({
			type: state.actionType,
			seriesId: seriesModel.id,
			targetNodeId
		} as any)
		return true
	}

	const layoutInfo = seriesModel.layoutInfo
	const width = Number(layoutInfo?.width)
	const height = Number(layoutInfo?.height)
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false

	const scaleX = width / state.sourceLayout.width
	const scaleY = height / state.sourceLayout.height
	chart.dispatchAction({
		type: 'treemapRender',
		seriesId: seriesModel.id,
		rootRect: {
			x: state.rootRect.x * scaleX,
			y: state.rootRect.y * scaleY,
			width: state.rootRect.width * scaleX,
			height: state.rootRect.height * scaleY
		}
	} as any)
	return true
}

function getGraphicArray(graphic: any): any[] {
	if (!graphic) return []
	return Array.isArray(graphic) ? graphic : [graphic]
}

function buildTreemapExportLabelGraphics(chart: echarts.ECharts, isDark: boolean): any[] {
	const seriesModel = getTreemapSeriesModel(chart)
	const viewRoot = seriesModel?.getViewRoot?.()
	const layoutInfo = seriesModel?.layoutInfo
	if (!seriesModel || !viewRoot || !layoutInfo) return []

	const graphics: any[] = []
	const baseX = Number(layoutInfo.x ?? 0)
	const baseY = Number(layoutInfo.y ?? 0)
	const labelFill = '#fff'
	const labelStroke = getChartTheme(isDark).exportLabelStroke

	const getNodeLabel = (node: any, includeValue: boolean) => {
		const formatted = stripRichText(String(seriesModel.getFormattedLabel?.(node.dataIndex, 'normal') ?? '')).trim()
		if (formatted) return formatted
		const name = typeof node.name === 'string' ? node.name : ''
		if (!includeValue) return name
		const value = getTreemapNumericValue(node.getValue?.())
		return value > 0 ? `${name}\n${formatTreemapUsd(value)}` : name
	}

	const addText = (node: any, x: number, y: number, width: number, height: number, includeValue: boolean) => {
		const text = getNodeLabel(node, includeValue)
		if (!text || width < 32 || height < 14) return
		graphics.push({
			id: `treemap-export-label-${graphics.length}`,
			type: 'text',
			left: x,
			top: y,
			z: TREEMAP_EXPORT_LABEL_Z,
			silent: true,
			style: {
				text,
				fill: labelFill,
				stroke: labelStroke,
				lineWidth: 3,
				fontSize: includeValue ? 12 : 13,
				fontWeight: includeValue ? 500 : 600,
				lineHeight: includeValue ? 16 : 15,
				width: Math.max(width, 0),
				height: Math.max(height, 0),
				overflow: 'truncate',
				lineOverflow: 'truncate'
			}
		})
	}

	const visit = (node: any, parentX: number, parentY: number, isRoot: boolean) => {
		const layout = node?.getLayout?.()
		if (!layout?.isInView) return

		const x = parentX + Number(layout.x ?? 0)
		const y = parentY + Number(layout.y ?? 0)
		const width = Number(layout.width ?? 0)
		const height = Number(layout.height ?? 0)
		const borderWidth = Number(layout.borderWidth ?? 0)
		const upperLabelHeight = Number(layout.upperLabelHeight ?? 0)
		const children = Array.isArray(node.viewChildren) ? node.viewChildren : []
		const isParent = children.length > 0

		if (!isRoot) {
			if (isParent && upperLabelHeight > 0) {
				addText(node, x + borderWidth + 4, y + 2, width - borderWidth * 2 - 8, upperLabelHeight - 4, false)
			} else {
				addText(
					node,
					x + borderWidth + 6,
					y + borderWidth + 4,
					width - borderWidth * 2 - 12,
					height - borderWidth * 2 - 8,
					true
				)
			}
		}

		for (const child of children) {
			visit(child, x, y, false)
		}
	}

	visit(viewRoot, baseX, baseY, true)
	return graphics
}

// --- PNG rasterization ---

/**
 * ECharts' SVG painter ignores the `type` param and always returns an SVG data URL
 * from getDataURL(). This helper detects that case and rasterizes the SVG to a PNG
 * asynchronously (Image.onload + Canvas), which getDataURL() can't do internally
 * because it's synchronous.
 */
async function getChartPngDataURL(
	chart: echarts.ECharts,
	opts: { pixelRatio?: number; backgroundColor?: string; excludeComponents?: string[] }
): Promise<string> {
	const { pixelRatio = 2, backgroundColor = '#ffffff', excludeComponents } = opts

	const dataUrlOptions: Parameters<echarts.ECharts['getDataURL']>[0] = {
		type: 'png',
		pixelRatio,
		backgroundColor
	}
	if (excludeComponents !== undefined) dataUrlOptions.excludeComponents = excludeComponents
	const dataURL = chart.getDataURL(dataUrlOptions)

	if (dataURL.startsWith('data:image/png')) {
		return dataURL
	}

	const img = new Image()
	await new Promise<void>((resolve, reject) => {
		img.onload = () => resolve()
		img.onerror = reject
		img.src = dataURL
	})

	const w = img.naturalWidth || img.width
	const h = img.naturalHeight || img.height
	const canvas = document.createElement('canvas')
	canvas.width = w * pixelRatio
	canvas.height = h * pixelRatio
	const ctx = canvas.getContext('2d')
	if (!ctx) return dataURL

	ctx.fillStyle = backgroundColor
	ctx.fillRect(0, 0, canvas.width, canvas.height)
	ctx.scale(pixelRatio, pixelRatio)
	ctx.drawImage(img, 0, 0, w, h)

	return canvas.toDataURL('image/png')
}

// --- Category logo overlay (for charts with axis logos) ---

const EXPORT_CATEGORY_LOGO_SIZE = 44
const EXPORT_CATEGORY_LOGO_GAP = 16
const EXPORT_HBAR_LOGO_SIZE = 36
const EXPORT_HBAR_LOGO_GAP = 12
const EXPORT_HBAR_LEFT_PAD = 16
const EXPORT_HBAR_LABEL_FONT = `${EXPORT_FONT_SIZE}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
const EXPORT_HBAR_LABEL_MAX_WIDTH = 360

function readStashedChartLogos(chart: echarts.ECharts): ChartLogoMetadata | undefined {
	const data = getChartLogoMetadata(chart)
	if (!data || typeof data !== 'object') return undefined
	if (data.kind === 'cartesian-x' && Array.isArray(data.logos) && Array.isArray(data.categoryValues)) {
		return data
	}
	if (data.kind === 'hbar' && Array.isArray(data.logos) && Array.isArray(data.categories)) {
		return data
	}
	return undefined
}

async function loadProxiedImage(url: string): Promise<HTMLImageElement | null> {
	if (!url) return null
	try {
		const response = await fetch(`/api/public/icon-proxy?url=${encodeURIComponent(url)}`)
		if (!response.ok) return null
		const blob = await response.blob()
		const dataUrl = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader()
			reader.onloadend = () => {
				if (typeof reader.result === 'string') resolve(reader.result)
				else reject(new Error('Failed to read icon'))
			}
			reader.onerror = reject
			reader.readAsDataURL(blob)
		})
		const img = new Image()
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve()
			img.onerror = reject
			img.src = dataUrl
		})
		return img
	} catch {
		return null
	}
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
	if (ctx.measureText(text).width <= maxWidth) return text
	let lo = 0
	let hi = text.length
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1
		if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid
		else hi = mid - 1
	}
	return lo > 0 ? text.slice(0, lo) + '…' : text
}

async function composeLogoOverlay(opts: {
	baseDataURL: string
	tempChart: echarts.ECharts
	logosData: ChartLogoMetadata
	isDark: boolean
	gridBottom: number
	chartCssWidth: number
	chartCssHeight: number
}): Promise<string> {
	const { baseDataURL, tempChart, logosData, isDark, gridBottom, chartCssWidth, chartCssHeight } = opts

	const loadedImgsPromise = Promise.all(logosData.logos.map((url) => (url ? loadProxiedImage(url) : null)))
	const chartImgPromise = new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image()
		img.onload = () => resolve(img)
		img.onerror = reject
		img.src = baseDataURL
	})
	const [loadedImgs, chartImg] = await Promise.all([loadedImgsPromise, chartImgPromise])

	const dpr = chartImg.width / chartCssWidth
	const canvas = document.createElement('canvas')
	canvas.width = chartImg.width
	canvas.height = chartImg.height
	const ctx = canvas.getContext('2d')
	if (!ctx) return baseDataURL

	ctx.drawImage(chartImg, 0, 0)
	ctx.scale(dpr, dpr)

	const logoBgColor = getChartTheme(isDark).logoBg

	if (logosData.kind === 'cartesian-x') {
		const centerY = chartCssHeight - gridBottom + EXPORT_CATEGORY_LOGO_GAP / 2 + EXPORT_CATEGORY_LOGO_SIZE / 2
		for (let i = 0; i < logosData.categoryValues.length; i++) {
			const img = loadedImgs[i]
			if (!img) continue
			const catVal = logosData.categoryValues[i]
			if (catVal == null) continue
			const x = tempChart.convertToPixel({ xAxisIndex: 0 }, catVal as any)
			if (typeof x !== 'number' || !Number.isFinite(x)) continue
			ctx.save()
			ctx.beginPath()
			ctx.arc(x, centerY, EXPORT_CATEGORY_LOGO_SIZE / 2, 0, 2 * Math.PI)
			ctx.fillStyle = logoBgColor
			ctx.fill()
			ctx.clip()
			ctx.drawImage(
				img,
				x - EXPORT_CATEGORY_LOGO_SIZE / 2,
				centerY - EXPORT_CATEGORY_LOGO_SIZE / 2,
				EXPORT_CATEGORY_LOGO_SIZE,
				EXPORT_CATEGORY_LOGO_SIZE
			)
			ctx.restore()
		}
	} else {
		ctx.font = EXPORT_HBAR_LABEL_FONT
		ctx.textBaseline = 'middle'
		ctx.fillStyle = getChartTheme(isDark).exportTextMuted
		const textX = EXPORT_HBAR_LEFT_PAD + EXPORT_HBAR_LOGO_SIZE + EXPORT_HBAR_LOGO_GAP
		for (const [categoryIndex, category] of logosData.categories.entries()) {
			const y = tempChart.convertToPixel({ yAxisIndex: 0 }, categoryIndex)
			if (typeof y !== 'number' || !Number.isFinite(y)) continue
			const img = loadedImgs[categoryIndex]
			if (img) {
				ctx.save()
				ctx.beginPath()
				ctx.arc(EXPORT_HBAR_LEFT_PAD + EXPORT_HBAR_LOGO_SIZE / 2, y, EXPORT_HBAR_LOGO_SIZE / 2, 0, 2 * Math.PI)
				ctx.fillStyle = logoBgColor
				ctx.fill()
				ctx.clip()
				ctx.drawImage(
					img,
					EXPORT_HBAR_LEFT_PAD,
					y - EXPORT_HBAR_LOGO_SIZE / 2,
					EXPORT_HBAR_LOGO_SIZE,
					EXPORT_HBAR_LOGO_SIZE
				)
				ctx.restore()
			}
			const text = truncateToWidth(ctx, category, EXPORT_HBAR_LABEL_MAX_WIDTH)
			ctx.fillText(text, textX, y)
		}
	}

	return canvas.toDataURL('image/png')
}

async function composeTreemapExportFrame(opts: {
	baseDataURL: string
	title: string | undefined
	iconBase64: string | null
	isDark: boolean
	topInset: number
	exportHeight: number
}): Promise<string> {
	const { baseDataURL, title, iconBase64, isDark, topInset, exportHeight } = opts

	const chartImg = await new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image()
		img.onload = () => resolve(img)
		img.onerror = reject
		img.src = baseDataURL
	})

	const dpr = chartImg.width / IMAGE_EXPORT_WIDTH
	const canvas = document.createElement('canvas')
	canvas.width = chartImg.width
	canvas.height = chartImg.height
	const ctx = canvas.getContext('2d')
	if (!ctx) return baseDataURL

	ctx.drawImage(chartImg, 0, 0)
	ctx.scale(dpr, dpr)

	const backgroundColor = getChartTheme(isDark).exportBg
	ctx.fillStyle = backgroundColor
	ctx.fillRect(0, 0, IMAGE_EXPORT_WIDTH, Math.max(0, topInset))
	ctx.fillRect(0, topInset, TREEMAP_EXPORT_SIDE_PADDING, exportHeight - topInset)
	ctx.fillRect(
		IMAGE_EXPORT_WIDTH - TREEMAP_EXPORT_SIDE_PADDING,
		topInset,
		TREEMAP_EXPORT_SIDE_PADDING,
		exportHeight - topInset
	)
	ctx.fillRect(0, exportHeight - TREEMAP_EXPORT_BOTTOM_PADDING, IMAGE_EXPORT_WIDTH, TREEMAP_EXPORT_BOTTOM_PADDING)

	if (title) {
		let textX = 14
		if (iconBase64) {
			try {
				const icon = await new Promise<HTMLImageElement>((resolve, reject) => {
					const img = new Image()
					img.onload = () => resolve(img)
					img.onerror = reject
					img.src = iconBase64
				})
				ctx.drawImage(icon, textX, BASE_TOP_PADDING, 32, 32)
				textX += 40
			} catch {
				// Ignore icon failures; the title is still the important export label.
			}
		}
		ctx.font = '600 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
		ctx.textBaseline = 'top'
		ctx.fillStyle = getChartTheme(isDark).exportText
		ctx.fillText(title, textX, BASE_TOP_PADDING)
	}

	return canvas.toDataURL('image/png')
}

function computeHBarLeftGridForExport(categories: string[]): number {
	const c = document.createElement('canvas').getContext('2d')
	if (!c) return EXPORT_HBAR_LEFT_PAD + EXPORT_HBAR_LOGO_SIZE + EXPORT_HBAR_LOGO_GAP + EXPORT_HBAR_LABEL_MAX_WIDTH + 16
	c.font = EXPORT_HBAR_LABEL_FONT
	let maxW = 0
	for (const cat of categories) {
		const w = Math.ceil(c.measureText(cat).width)
		if (w > maxW) maxW = w
	}
	const labelW = Math.min(maxW, EXPORT_HBAR_LABEL_MAX_WIDTH)
	return EXPORT_HBAR_LEFT_PAD + EXPORT_HBAR_LOGO_SIZE + EXPORT_HBAR_LOGO_GAP + labelW + 16
}

// --- Icon loading ---

async function loadCircularIcon(url: string): Promise<string | null> {
	try {
		const response = await fetch(getChartExportIconFetchUrl(url))
		if (!response.ok) return null

		const blob = await response.blob()
		const base64 = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader()
			reader.onloadend = () => {
				if (typeof reader.result === 'string') {
					resolve(reader.result)
					return
				}
				reject(new Error('Failed to convert icon to base64'))
			}
			reader.onerror = reject
			reader.readAsDataURL(blob)
		})

		const img = new Image()
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve()
			img.onerror = reject
			img.src = base64
		})

		const canvas = document.createElement('canvas')
		canvas.width = img.width
		canvas.height = img.height
		const ctx = canvas.getContext('2d')
		if (!ctx) return base64

		ctx.beginPath()
		ctx.arc(img.width / 2, img.height / 2, Math.min(img.width, img.height) / 2, 0, 2 * Math.PI)
		ctx.closePath()
		ctx.clip()
		ctx.drawImage(img, 0, 0)
		return canvas.toDataURL()
	} catch {
		return null
	}
}

// --- Axis scaling for export ---

export function scaleXAxisForExport(xAxis: XAXisComponentOption[]): XAXisComponentOption[] {
	return xAxis.map((axis) => {
		const sourceLabel = axis.axisLabel ?? {}
		// A crowded category axis rotates its labels and forces every one on (interval:0). Keep them
		// all in the export — re-hiding overlaps at the doubled font would silently drop the very
		// labels the rotation was added to save.
		const isRotated = typeof sourceLabel.rotate === 'number' && sourceLabel.rotate !== 0
		const scaled = mergeDeep(axis, {
			nameTextStyle: { ...(axis.nameTextStyle ?? {}), fontSize: EXPORT_FONT_SIZE },
			axisLabel: {
				...sourceLabel,
				fontSize: EXPORT_FONT_SIZE,
				inside: false,
				hideOverlap: !isRotated
			}
		})
		if (axis.name) {
			scaled.nameGap = Math.max(axis.nameGap ?? 15, 36)
		}
		return scaled
	})
}

export function scaleYAxisForExport(
	yAxis: YAXisComponentOption[],
	isHorizontalBarChart: boolean
): YAXisComponentOption[] {
	return yAxis.map((axis) => {
		const sourceAxisLabel = axis.axisLabel ?? {}
		// The on-screen axisLabel.width is a truncation cap sized for the on-screen font. Export doubles the
		// font (EXPORT_FONT_SIZE), so the same cap chops labels ("Bybit.eu (MiCA)" -> "Bybit.eu (Mi..."). Scale
		// the cap by the same font ratio so the visible label length is preserved in the PNG.
		const sourceLabelFontSize =
			typeof sourceAxisLabel.fontSize === 'number' && sourceAxisLabel.fontSize > 0 ? sourceAxisLabel.fontSize : 12
		const scaledLabelWidth =
			typeof sourceAxisLabel.width === 'number' && Number.isFinite(sourceAxisLabel.width)
				? Math.round((sourceAxisLabel.width * EXPORT_FONT_SIZE) / sourceLabelFontSize)
				: sourceAxisLabel.width
		const scaled = mergeDeep(axis, {
			nameTextStyle: { ...(axis.nameTextStyle ?? {}), fontSize: EXPORT_FONT_SIZE },
			axisLabel: {
				...sourceAxisLabel,
				fontSize: EXPORT_FONT_SIZE,
				inside: false,
				hideOverlap: true,
				...(scaledLabelWidth != null ? { width: scaledLabelWidth } : {})
			},
			axisLine: {
				...(axis.axisLine ?? {}),
				lineStyle: { ...(axis.axisLine?.lineStyle ?? {}), width: 2 }
			}
		})
		if (axis.offset) {
			scaled.offset = axis.offset * 2
		}
		if (axis.name) {
			scaled.nameGap = Math.max(axis.nameGap ?? 15, 36)
		}
		if (isHorizontalBarChart && axis.type === 'category') {
			scaled.boundaryGap = true
			// getOption() includes the live hover status; the export clone should not keep that shadow.
			scaled.axisPointer = { ...(scaled.axisPointer ?? {}), status: 'hide' }
		}
		return scaled
	})
}

// --- Graphic (watermark) scaling for export ---

function scaleGraphicForExport(graphic: any[]): any[] {
	return graphic.map((g) => {
		if (!g.elements) return g
		return {
			...g,
			elements: g.elements.map((element: any) => {
				if (!element.style?.image?.startsWith('/assets/defillama-')) return element
				const targetHeight = 80
				const imageWidth = Math.round((389 / 133) * targetHeight)
				return {
					...element,
					style: { ...element.style, height: targetHeight, width: imageWidth },
					top: '320px',
					left: `${(IMAGE_EXPORT_WIDTH - imageWidth) / 2}px`
				}
			})
		}
	})
}

// --- Legend item collection ---

function collectLegendItems(options: EChartsOption, isPieChart: boolean): string[] {
	const legendConfig = options.legend
	const legendArray = Array.isArray(legendConfig) ? legendConfig : legendConfig ? [legendConfig] : []

	if (legendArray.length > 0 && Array.isArray(legendArray[0]?.data)) {
		return legendArray[0].data.filter((item): item is string => typeof item === 'string')
	}
	if (isPieChart) {
		const items: string[] = []
		for (const s of getSeriesOptions(options)) {
			if (s?.type !== 'pie' || !Array.isArray(s.data)) continue
			for (const item of s.data) {
				if (item && typeof item === 'object' && !Array.isArray(item) && item.name != null) {
					items.push(String(item.name))
				}
			}
		}
		return items
	}
	return getSeriesOptions(options).flatMap((series) => (series.name ? [String(series.name)] : []))
}

function isLegendVisibleForExport(flags: SeriesFlags, options: EChartsOption): boolean {
	if (flags.isSankeyChart || flags.isTreemapChart) return false
	if (flags.isPieChart) {
		const legendConfig = options.legend
		const legendArray = Array.isArray(legendConfig) ? legendConfig : legendConfig ? [legendConfig] : []
		return legendArray.length > 0 ? legendArray.some((legend) => legend?.show !== false) : false
	}
	return true
}

// --- Series adjustments for export ---

function adjustSeriesForExport(opts: {
	series: SeriesOption[]
	flags: SeriesFlags
	layout: ExportLayout
	isDark: boolean
	title: string | undefined
	expandLegend: boolean | undefined
	exportHeight?: number
	treemapViewportState?: TreemapViewportExportState | null
}): SeriesOption[] {
	const { flags, layout, isDark, title, expandLegend, exportHeight, treemapViewportState } = opts
	let series = [...opts.series]

	// Scatter: strip image:// symbols and scale labels for export
	series = series.map((s) => {
		if (s?.type !== 'scatter') return s
		const next = { ...s }
		if (Array.isArray(s.data)) {
			next.data = s.data.map((point: any) => {
				if (point && typeof point === 'object' && !Array.isArray(point)) {
					const p = { ...point }
					if (typeof p.symbol === 'string' && p.symbol.startsWith('image://')) {
						delete p.symbol
						p.symbolSize = typeof p.symbolSize === 'number' ? Math.min(p.symbolSize, 12) : 10
					}
					return p
				}
				return point
			})
		}
		if (typeof next.symbol === 'string' && next.symbol.startsWith('image://')) {
			delete next.symbol
			next.symbolSize = typeof next.symbolSize === 'number' ? Math.min(next.symbolSize, 12) : 10
		}
		if (next.label) {
			const labelFontSize = typeof next.label.fontSize === 'number' ? next.label.fontSize : 10
			next.label = { ...next.label, fontSize: Math.round(labelFontSize * 2) }
		}
		return next
	})

	// MarkLine: scale labels and line widths for the larger export canvas
	series = series.map((s) => {
		if (!s?.markLine) return s
		const next = { ...s }
		const ml = { ...s.markLine }
		if (ml.label) {
			ml.label = { ...ml.label, fontSize: EXPORT_FONT_SIZE }
		}
		if (ml.lineStyle) {
			ml.lineStyle = { ...ml.lineStyle, width: Math.max(2, Number(ml.lineStyle.width ?? 1) * 2) }
		}
		if (Array.isArray(ml.data)) {
			ml.data = ml.data.map((segment: any) => {
				if (!Array.isArray(segment)) return segment
				return segment.map((point: any) => {
					if (!point || typeof point !== 'object') return point
					const p = { ...point }
					if (p.label) {
						p.label = { ...p.label, fontSize: EXPORT_FONT_SIZE }
					}
					if (p.emphasis?.label) {
						p.emphasis = { ...p.emphasis, label: { ...p.emphasis.label, fontSize: EXPORT_FONT_SIZE } }
					}
					if (typeof p.y === 'number') {
						p.y = Math.max(p.y * 2, layout.gridTop + 8)
					}
					return p
				})
			})
		}
		next.markLine = ml
		return next
	})

	// Sankey: scale labels and increase spacing for readability
	if (flags.isSankeyChart) {
		series = series.map((s) => {
			if (s.type !== 'sankey') return s
			return {
				...s,
				top: title ? 60 : 30,
				label: {
					...(s.label ?? {}),
					fontSize: 18,
					rich: {
						name: {
							fontSize: 18,
							fontWeight: 'normal',
							color: getChartTheme(isDark).exportLegendText
						},
						desc: {
							fontSize: 12,
							color: getChartTheme(isDark).exportLegendInactive
						}
					}
				},
				nodeGap: 28,
				nodeWidth: 20
			}
		})
	}

	// HBar: scale bar widths to fill the fixed 720px canvas
	if (flags.isHorizontalBarChart) {
		const categoryCount =
			flags.yAxisConfig?.type === 'category' && Array.isArray(flags.yAxisConfig.data)
				? flags.yAxisConfig.data.length
				: 0
		const bottomPadding = expandLegend ? 32 : 16
		const plotHeight = Math.max(1, (exportHeight ?? IMAGE_EXPORT_HEIGHT) - layout.gridTop - bottomPadding)
		const bandHeight = categoryCount > 0 ? plotHeight / categoryCount : plotHeight
		const barStacks = new Set<string>()
		for (const s of series) {
			if (s?.type === 'bar') barStacks.add(String(s.stack ?? s.name ?? ''))
		}
		const barSeriesCount = Math.max(1, barStacks.size)
		const barWidth = Math.max(8, Math.min(80, Math.floor((bandHeight * 0.65) / barSeriesCount)))
		series = series.map((s) => (s?.type === 'bar' ? { ...s, barWidth } : s))
	}

	// Pie: recenter for the fixed export canvas and hide labels when legend is shown
	if (flags.isPieChart && layout.hasLegend) {
		series = series.map((s): SeriesOption => {
			if (s?.type !== 'pie') return s
			const existingLabelLayout = s.labelLayout
			const nextLabelLayout =
				typeof existingLabelLayout === 'function'
					? existingLabelLayout
					: { ...(existingLabelLayout ?? {}), hideOverlap: true }
			const left = parsePixelValue(s.left) ?? 0
			const right = parsePixelValue(s.right) ?? 0
			const drawableWidth = Math.max(1, IMAGE_EXPORT_WIDTH - left - right)
			const nextCenterX = Math.round(left + drawableWidth / 2)
			const nextCenterY = Array.isArray(s.center) && s.center.length > 1 ? (s.center[1] ?? '50%') : '50%'
			const next: PieSeriesOption = {
				...s,
				center: [nextCenterX, nextCenterY],
				avoidLabelOverlap: true,
				labelLayout: nextLabelLayout,
				label: { ...(s.label ?? {}), show: false },
				labelLine: { ...(s.labelLine ?? {}), show: false }
			}
			return next
		})
	}

	// Treemap: push chart body below title area
	if (flags.isTreemapChart) {
		series = series.map((s): SeriesOption => {
			if (s?.type !== 'treemap') return s
			const { levels: sourceLevels, ...treemapSeries } = s
			// The cloned export must declare labels at both series and level scope.
			// ECharts treemap levels can override series labels, which previously produced normalized PNGs with no text.
			const total = Array.isArray(s.data)
				? s.data.reduce((sum: number, item) => {
						return sum + getTreemapNumericValue(item?.value)
					}, 0)
				: 0
			const sourceLabel = s.label ?? {}
			const exportLabelFormatter = (params: DefaultLabelFormatterCallbackParams) =>
				formatTreemapExportLabel(params, total, sourceLabel.formatter)
			const exportLabel: TreemapExportLabelOption = {
				...sourceLabel,
				show: true,
				position: sourceLabel.position ?? 'insideTopLeft',
				padding: sourceLabel.padding ?? [4, 6],
				formatter: exportLabelFormatter,
				rich: {
					name: {
						fontSize: 16,
						fontWeight: 600,
						color: '#fff',
						lineHeight: 22
					},
					value: {
						fontSize: 13,
						color: 'rgba(255,255,255,0.85)',
						lineHeight: 18
					},
					...(sourceLabel.rich ?? {})
				}
			}
			const sourceUpperLabel = s.upperLabel ?? {}
			const exportUpperLabel: TreemapExportLabelOption = {
				...sourceUpperLabel,
				show: sourceUpperLabel.show !== false,
				color: sourceUpperLabel.color ?? getChartTheme(isDark).treemapLabel,
				formatter:
					typeof sourceUpperLabel.formatter === 'function'
						? sourceUpperLabel.formatter
						: (params: DefaultLabelFormatterCallbackParams) => String(params.name ?? '')
			}
			const targetDataRoot = getTreemapTargetDataRoot(s, treemapViewportState ?? null)
			const exportData = targetDataRoot?.data ?? s.data
			const next: TreemapSeriesOption = {
				...treemapSeries,
				...(targetDataRoot ? { name: targetDataRoot.name } : {}),
				top: layout.gridTop,
				left: TREEMAP_EXPORT_SIDE_PADDING,
				right: TREEMAP_EXPORT_SIDE_PADDING,
				bottom: TREEMAP_EXPORT_BOTTOM_PADDING,
				breadcrumb: { ...(s?.breadcrumb ?? {}), show: false },
				label: exportLabel,
				upperLabel: exportUpperLabel
			}
			if (Array.isArray(exportData)) {
				next.data = applyTreemapDataExportLabels(exportData, exportLabel, exportUpperLabel)
			} else if (exportData !== undefined) {
				next.data = exportData
			}
			if (Array.isArray(sourceLevels)) {
				next.levels = sourceLevels.map((level: TreemapSeriesLevelOption) => {
					const levelLabel = level?.label ?? {}
					const levelUpperLabel = level?.upperLabel ?? {}
					return {
						...level,
						label: {
							...exportLabel,
							...levelLabel,
							show: true,
							formatter: typeof levelLabel.formatter === 'function' ? levelLabel.formatter : exportLabelFormatter
						},
						upperLabel: {
							...exportUpperLabel,
							...levelUpperLabel,
							show: levelUpperLabel.show ?? exportUpperLabel.show,
							formatter:
								typeof levelUpperLabel.formatter === 'function' ? levelUpperLabel.formatter : exportUpperLabel.formatter
						}
					}
				})
			}
			return next
		})
	}

	return series
}

// --- Export title construction ---

function buildExportTitle(opts: {
	title: string | undefined
	iconBase64: string | null
	isDark: boolean
}): TitleComponentOption {
	const { title, iconBase64, isDark } = opts
	const textStyle: NonNullable<TitleComponentOption['textStyle']> = {
		fontSize: 28,
		fontWeight: 600,
		color: getChartTheme(isDark).text
	}
	if (iconBase64) {
		textStyle.rich = {
			icon: {
				height: 32,
				width: 32,
				verticalAlign: 'middle',
				backgroundColor: { image: iconBase64 }
			}
		}
	}
	const titleOption: TitleComponentOption = {
		textStyle,
		left: 14,
		top: BASE_TOP_PADDING,
		z: EXPORT_TITLE_Z
	}
	if (iconBase64) titleOption.text = `{icon|} ${title}`
	else if (title !== undefined) titleOption.text = title
	return titleOption
}

// --- Chart render wait ---

export function mutateAndWaitForChartRender(
	chart: echarts.ECharts,
	mutate: () => void | boolean,
	timeoutMs = 1500
): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		let timeoutId: ReturnType<typeof setTimeout> | null = null
		let settled = false
		const finish = () => {
			if (settled) return
			settled = true
			if (timeoutId) clearTimeout(timeoutId)
			chart.off('rendered', handler)
			resolve()
		}
		const handler = () => {
			finish()
		}
		timeoutId = setTimeout(() => {
			finish()
		}, timeoutMs)
		chart.on('rendered', handler)
		try {
			if (mutate() === false) finish()
		} catch (error) {
			if (timeoutId) clearTimeout(timeoutId)
			chart.off('rendered', handler)
			reject(error)
		}
	})
}

// --- Clone export orchestrator ---

async function renderClonedChartExport(
	tempContainer: HTMLDivElement,
	originalChart: echarts.ECharts,
	isDark: boolean,
	title: string | undefined,
	iconUrl: string | undefined,
	expandLegend: boolean | undefined,
	pngProfile?: PngExportProfile
): Promise<string> {
	const { echarts: echartsCore } = await import('./chartExportEcharts')
	// getOption() exposes ECharts' uncomposed core type, even though this app registers
	// the full option set. Normalize it once, then keep every export transform typed.
	const currentOptions = originalChart.getOption() as EChartsOption

	const flags = detectSeriesFlags(currentOptions)
	const stashedLogos = readStashedChartLogos(originalChart)
	const treemapViewportState = flags.isTreemapChart ? readTreemapViewportExportState(originalChart) : null
	let exportHeight = IMAGE_EXPORT_HEIGHT
	if (pngProfile === 'hbar' && flags.isHorizontalBarChart) {
		const categoryCount =
			flags.yAxisConfig?.type === 'category' && Array.isArray(flags.yAxisConfig.data)
				? flags.yAxisConfig.data.length
				: 0
		if (categoryCount > 0) {
			const minBarHeight = 36
			exportHeight = Math.max(IMAGE_EXPORT_HEIGHT, categoryCount * minBarHeight + 120)
		}
	}

	tempContainer.style.height = `${exportHeight}px`

	const tempChart = echartsCore.init(tempContainer, null, {
		width: IMAGE_EXPORT_WIDTH,
		height: exportHeight,
		renderer: 'canvas'
	})

	try {
		const iconBase64 = iconUrl ? await loadCircularIcon(iconUrl) : null

		// Treemap labels rely on local rich-text sizing; a global boost makes them too large.
		if (!flags.isTreemapChart) {
			currentOptions.textStyle = { ...(currentOptions.textStyle ?? {}), fontSize: EXPORT_FONT_SIZE }
		}

		if (currentOptions.xAxis) {
			currentOptions.xAxis = scaleXAxisForExport(
				Array.isArray(currentOptions.xAxis) ? currentOptions.xAxis : [currentOptions.xAxis]
			)
		}
		if (currentOptions.yAxis) {
			currentOptions.yAxis = scaleYAxisForExport(
				Array.isArray(currentOptions.yAxis) ? currentOptions.yAxis : [currentOptions.yAxis],
				flags.isHorizontalBarChart
			)
		}
		if (currentOptions.graphic) {
			currentOptions.graphic = scaleGraphicForExport(currentOptions.graphic as any[])
		}

		const legendItems = collectLegendItems(currentOptions, flags.isPieChart)
		const showLegend = isLegendVisibleForExport(flags, currentOptions)
		const hasMarkLineHallmarks = (
			Array.isArray(currentOptions.series) ? currentOptions.series : [currentOptions.series]
		).some((s: any) => s?.markLine?.data?.length)
		const layout = computeExportLayout({
			title,
			legendItems,
			shouldShowLegend: showLegend,
			hasIcon: !!iconBase64,
			expandLegend,
			hasMarkLineHallmarks
		})

		currentOptions.series = adjustSeriesForExport({
			series: getSeriesOptions(currentOptions),
			flags,
			layout,
			isDark,
			title,
			expandLegend,
			exportHeight,
			treemapViewportState
		})

		currentOptions.title = buildExportTitle({ title, iconBase64, isDark })
		currentOptions.animation = false

		if (!flags.isSankeyChart) {
			const hasYAxisName = Array.isArray(currentOptions.yAxis) && currentOptions.yAxis.some((axis) => !!axis?.name)
			const hasXAxisName = Array.isArray(currentOptions.xAxis) && currentOptions.xAxis.some((axis) => !!axis?.name)
			const scatterLeftPad = flags.isScatterChart && hasYAxisName ? 48 : 16
			const scatterBottomPad = flags.isScatterChart && hasXAxisName ? 48 : expandLegend ? 32 : 16
			let gridLeft: number = scatterLeftPad
			let gridBottom: number = scatterBottomPad
			let outerBoundsContain: 'axisLabel' | undefined = 'axisLabel'
			if (stashedLogos?.kind === 'cartesian-x') {
				gridBottom = scatterBottomPad + EXPORT_CATEGORY_LOGO_SIZE + EXPORT_CATEGORY_LOGO_GAP
				outerBoundsContain = undefined
			} else if (stashedLogos?.kind === 'hbar') {
				gridLeft = computeHBarLeftGridForExport(stashedLogos.categories)
				outerBoundsContain = undefined
			}
			currentOptions.grid = {
				left: gridLeft,
				bottom: gridBottom,
				top: layout.gridTop,
				right: 16,
				outerBoundsMode: 'same',
				outerBoundsContain
			}
		}

		if (layout.hasLegend) {
			const legendBase = {
				show: true,
				textStyle: {
					fontSize: EXPORT_FONT_SIZE,
					color: getChartTheme(isDark).text
				},
				itemHeight: 24,
				itemWidth: 48,
				itemGap: LEGEND_ITEM_GAP,
				top: layout.legendTop,
				right: 16
			}
			currentOptions.legend = expandLegend
				? { ...legendBase, type: 'plain', padding: [0, 0, 0, 0], ...(layout.canShareRow ? {} : { left: 16 }) }
				: { ...legendBase, type: 'scroll', padding: [0, 0, 0, 18], pageButtonPosition: 'end' }
		}

		await mutateAndWaitForChartRender(tempChart, () => tempChart.setOption(currentOptions))
		if (treemapViewportState) {
			await mutateAndWaitForChartRender(tempChart, () =>
				applyTreemapViewportExportState(tempChart, treemapViewportState)
			)
		}

		if (flags.isTreemapChart) {
			const labelGraphics = buildTreemapExportLabelGraphics(tempChart, isDark)
			if (labelGraphics.length > 0) {
				currentOptions.graphic = [...getGraphicArray(currentOptions.graphic), ...labelGraphics]
				const graphicOption: EChartsOption = { graphic: currentOptions.graphic }
				await mutateAndWaitForChartRender(tempChart, () => tempChart.setOption(graphicOption))
			}
		}

		const baseDataURL = await getChartPngDataURL(tempChart, {
			pixelRatio: 2,
			backgroundColor: getChartTheme(isDark).exportBg,
			excludeComponents: ['toolbox', 'dataZoom']
		})
		const exportDataURL = flags.isTreemapChart
			? await composeTreemapExportFrame({
					baseDataURL,
					title,
					iconBase64,
					isDark,
					topInset: layout.gridTop,
					exportHeight
				})
			: baseDataURL

		if (!stashedLogos) {
			return exportDataURL
		}

		try {
			return await composeLogoOverlay({
				baseDataURL: exportDataURL,
				tempChart,
				logosData: stashedLogos,
				isDark,
				gridBottom: Number(
					(Array.isArray(currentOptions.grid) ? currentOptions.grid[0]?.bottom : currentOptions.grid?.bottom) ?? 16
				),
				chartCssWidth: IMAGE_EXPORT_WIDTH,
				chartCssHeight: exportHeight
			})
		} catch (error) {
			console.log('Failed to compose logo overlay:', error)
			return exportDataURL
		}
	} finally {
		tempChart.dispose()
	}
}

// --- Component ---

const DEFAULT_CLASSNAME = buttonStyles({ size: 'md' })

interface ChartPngExportButtonProps {
	chartInstance: () => echarts.ECharts | null
	className?: string | undefined
	smol?: boolean | undefined
	title?: string | undefined
	filename?: string | undefined
	iconUrl?: string | undefined
	expandLegend?: boolean | undefined
	pngProfile?: PngExportProfile | undefined
	onExport?: ((info: { kind: 'download' | 'copy'; filename: string }) => void) | undefined
	/** Consolidated export menu: icon-only disclosure with a "Download CSV" item on top
	 * of the image actions. Used by the LlamaAI chat toolbar; other pages keep the
	 * separate .csv/.png buttons. */
	csvMenuItem?: { prepareCsv: () => { filename: string; rows: Array<Array<CsvCell>> } } | undefined
	iconOnly?: boolean | undefined
}

export function ChartPngExportButton({
	chartInstance,
	className = DEFAULT_CLASSNAME,
	smol = true,
	title,
	filename,
	iconUrl,
	expandLegend,
	pngProfile = 'default',
	onExport,
	csvMenuItem,
	iconOnly = false
}: ChartPngExportButtonProps) {
	const [isLoading, setIsLoading] = useState(false)
	const router = useRouter()
	const popover = Ariakit.usePopoverStore({ placement: 'bottom-end' })

	const [isDark] = useDarkModeManager()

	const generateDataURL = async (): Promise<string | null> => {
		const _chartInstance = chartInstance()

		if (!_chartInstance) {
			toast.error('Failed to get chart instance')
			return null
		}
		setIsLoading(true)

		const tempContainer = document.createElement('div')
		tempContainer.style.cssText = `width:${IMAGE_EXPORT_WIDTH}px;height:${IMAGE_EXPORT_HEIGHT}px;position:absolute;left:-99999px;top:0;`
		document.body.appendChild(tempContainer)

		try {
			const dataURL = await renderClonedChartExport(
				tempContainer,
				_chartInstance,
				isDark,
				title,
				iconUrl,
				expandLegend,
				pngProfile
			)
			document.body.removeChild(tempContainer)
			return dataURL
		} catch (error) {
			console.log('Error exporting chart image:', error)
			toast.error('Failed to export chart image')
			document.body.removeChild(tempContainer)
			return null
		}
	}

	const handleDownload = () => {
		if (isLoading) return
		popover.hide()
		generateDataURL()
			.then((dataURL) => {
				if (!dataURL) return
				let safeFilename = filename || 'chart'
				if (safeFilename.toLowerCase().endsWith('.png')) {
					safeFilename = safeFilename.slice(0, -4)
				}
				const imageFilename = `${safeFilename}_${new Date().toISOString().split('T')[0]}.png`
				downloadDataURL(imageFilename, dataURL)
				onExport?.({ kind: 'download', filename: imageFilename })
			})
			.catch((error) => {
				console.log('Error exporting chart image:', error)
				toast.error('Failed to export chart image')
			})
			.finally(() => setIsLoading(false))
	}

	const handleCopyToClipboard = () => {
		if (isLoading) return
		popover.hide()
		// Safari requires clipboard.write() to be called synchronously within
		// the user gesture. Passing a Promise<Blob> to ClipboardItem defers the
		// async work while keeping the write() call in the gesture context.
		const blobPromise = (async () => {
			const dataURL = await generateDataURL()
			if (!dataURL) throw new Error('Failed to generate image')
			const response = await fetch(dataURL)
			return await response.blob()
		})()

		navigator.clipboard
			.write([new ClipboardItem({ 'image/png': blobPromise })])
			.then(() => {
				toast.success('Image copied to clipboard')
				onExport?.({ kind: 'copy', filename: filename || 'chart' })
			})
			.catch((error) => {
				console.log('Error copying chart image:', error)
				toast.error('Failed to copy image to clipboard')
			})
			.finally(() => setIsLoading(false))
	}

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure
				className={className}
				data-loading={isLoading}
				disabled={isLoading}
				title={csvMenuItem ? 'Export chart' : 'Export chart as image'}
			>
				{isLoading ? <LoadingSpinner size={14} /> : <Icon name="download-paper" height={14} width={14} />}
				{iconOnly ? null : <span>{smol ? '.png' : 'Image'}</span>}
			</Ariakit.PopoverDisclosure>

			<Ariakit.Popover
				gutter={8}
				unmountOnHide
				wrapperProps={{ className: popoverMobileWrapperClassName }}
				className={`${menuSurfaceStyles} z-50`}
				portal
			>
				<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
					<Icon name="x" className="size-5" />
				</Ariakit.PopoverDismiss>
				{csvMenuItem ? (
					<button
						data-umami-event="export-csv"
						data-umami-event-page={router.pathname}
						type="button"
						className={popoverMenuItemStyles}
						onClick={() => {
							try {
								const { filename: csvFilename, rows } = csvMenuItem.prepareCsv()
								downloadCSV(csvFilename.endsWith('.csv') ? csvFilename : `${csvFilename}.csv`, rows, {
									addTimestamp: false
								})
							} catch {
								toast.error('Failed to export CSV')
							}
							popover.hide()
						}}
					>
						<Icon name="download-paper" height={14} width={14} />
						<span>Download CSV</span>
					</button>
				) : null}
				<button
					data-umami-event="export-image"
					data-umami-event-page={router.pathname}
					type="button"
					className={popoverMenuItemStyles}
					onClick={() => void handleDownload()}
				>
					<Icon name="download-paper" height={14} width={14} />
					<span>Download image</span>
				</button>
				<button
					data-umami-event="copy-image"
					data-umami-event-page={router.pathname}
					type="button"
					className={popoverMenuItemStyles}
					onClick={() => void handleCopyToClipboard()}
				>
					<Icon name="copy" height={14} width={14} />
					<span>Copy to clipboard</span>
				</button>
			</Ariakit.Popover>
		</Ariakit.PopoverProvider>
	)
}
