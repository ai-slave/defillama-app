import type { DashboardItemConfig } from '../dashboardItemConfig'
import { getDashboardItemLayout } from '../dashboardLayout/cardHeight'
import { dashboardItemLabel, truncateText } from '../utils/seo'
import { DASHBOARD_ITEM_KIND_SUMMARY_LABELS } from './dashboardItemKindSummary'

export type DashboardPreviewTileShape = 'line' | 'area' | 'bars' | 'stacked' | 'pie' | 'number' | 'table' | 'text'

export interface DashboardPreviewTile {
	id: string
	shape: DashboardPreviewTileShape
	span: 1 | 2
	label: string
	seed: number
}

export type DashboardPreviewItem =
	| DashboardItemConfig
	| { id?: string | undefined; kind?: string | undefined; [key: string]: unknown }

export const DASHBOARD_PREVIEW_COLUMNS = 4
export const DASHBOARD_PREVIEW_ROWS = 3
export const DASHBOARD_PREVIEW_COLUMN_BUDGET = DASHBOARD_PREVIEW_COLUMNS * DASHBOARD_PREVIEW_ROWS

const FNV_OFFSET_BASIS = 2_166_136_261
const FNV_PRIME = 16_777_619

export function previewSeed(id: string): number {
	let hash = FNV_OFFSET_BASIS
	for (let index = 0; index < id.length; index++) {
		hash ^= id.charCodeAt(index)
		hash = Math.imul(hash, FNV_PRIME)
	}
	return (hash >>> 0) % 2_147_483_648
}

export function previewSeries(seed: number, points = 24): Array<number> {
	let state = (seed % 2_147_483_646) + 1
	let value = 0.5
	const series: Array<number> = []
	for (let index = 0; index < points; index++) {
		state = (state * 48_271) % 2_147_483_647
		value = Math.min(1, Math.max(0, value + (state / 2_147_483_647 - 0.45) * 0.28))
		series.push(value)
	}
	return series
}

const BAR_CHART_TYPES = new Set([
	'volume',
	'fees',
	'revenue',
	'chainFees',
	'chainRevenue',
	'holdersRevenue',
	'incentives',
	'perps',
	'aggregators',
	'perpsAggregators',
	'bridgeAggregators',
	'optionsPremium',
	'optionsNotional',
	'activeUsers',
	'newUsers',
	'txs',
	'gasUsed',
	'tokenVolume',
	'unlocks'
])

const TABLE_KINDS = new Set(['unified-table', 'dataset-table', 'custom-data', 'sql'])

function tileShape(item: DashboardPreviewItem, kind: string): DashboardPreviewTileShape {
	if (kind === 'chart') {
		const type = 'type' in item && typeof item.type === 'string' ? item.type : ''
		return BAR_CHART_TYPES.has(type) ? 'bars' : 'area'
	}
	if (kind === 'multi') return 'line'
	if (kind === 'builder') return 'stacked'
	if (kind === 'unlocks-pie') return 'pie'
	if (kind === 'rwa-overview') {
		const chartView = 'chartView' in item && typeof item.chartView === 'string' ? item.chartView : ''
		return chartView === 'pie' ? 'pie' : 'area'
	}
	if (kind === 'metric') return 'number'
	if (TABLE_KINDS.has(kind)) return 'table'
	if (kind === 'text') return 'text'
	return 'area'
}

const SPAN_BY_COL_SPAN: Record<number, 1 | 2> = { 0.5: 1, 1: 2, 1.5: 2, 2: 2 }

function isFullItemConfig(item: DashboardPreviewItem): item is DashboardItemConfig {
	for (const key of Object.keys(item)) {
		if (key !== 'id' && key !== 'kind') return true
	}
	return false
}

function tileSpan(item: DashboardPreviewItem, kind: string): 1 | 2 {
	const defaultSpan = kind === 'metric' || kind === 'text' ? 1 : 2
	if (kind === 'text') return 1
	if (!isFullItemConfig(item)) return defaultSpan
	const { colSpan } = getDashboardItemLayout(item)
	if (colSpan === undefined) return defaultSpan
	return SPAN_BY_COL_SPAN[colSpan] ?? 2
}

const DASHBOARD_PREVIEW_LABEL_MAX_LENGTH = 40

function isPreviewKind(kind: string): kind is DashboardItemConfig['kind'] {
	return Object.hasOwn(DASHBOARD_ITEM_KIND_SUMMARY_LABELS, kind)
}

function tileLabel(item: DashboardPreviewItem, kind: DashboardItemConfig['kind']): string {
	if (kind === 'text') {
		const title = 'title' in item && typeof item.title === 'string' ? item.title.trim() : ''
		return title ? truncateText(title, DASHBOARD_PREVIEW_LABEL_MAX_LENGTH) : 'Note'
	}
	if (isFullItemConfig(item)) {
		try {
			return truncateText(dashboardItemLabel(item), DASHBOARD_PREVIEW_LABEL_MAX_LENGTH)
		} catch {
			return DASHBOARD_ITEM_KIND_SUMMARY_LABELS[kind].one
		}
	}
	return DASHBOARD_ITEM_KIND_SUMMARY_LABELS[kind].one
}

export function buildDashboardPreview(
	items: ReadonlyArray<DashboardPreviewItem | null | undefined>
): Array<DashboardPreviewTile> {
	const tiles: Array<DashboardPreviewTile> = []
	let usedColumns = 0

	for (let index = 0; index < items.length; index++) {
		const item = items[index]
		if (!item) continue
		const kind = typeof item.kind === 'string' ? item.kind : ''
		if (!isPreviewKind(kind) || kind === 'section') continue
		const span = tileSpan(item, kind)
		if (usedColumns + span > DASHBOARD_PREVIEW_COLUMN_BUDGET) continue
		usedColumns += span
		const id = typeof item.id === 'string' && item.id ? item.id : `${kind}-${index}`
		tiles.push({
			id,
			shape: tileShape(item, kind),
			span,
			label: tileLabel(item, kind),
			seed: previewSeed(id)
		})
		if (usedColumns >= DASHBOARD_PREVIEW_COLUMN_BUDGET) break
	}

	return tiles
}
