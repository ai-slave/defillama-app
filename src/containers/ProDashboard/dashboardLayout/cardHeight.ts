import type { CSSProperties } from 'react'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { DashboardCardHeight, DashboardItemLayout } from '../types'

export const DASHBOARD_CARD_HEIGHT_SCALE = { compact: 0.75, default: 1, tall: 1.4 } as const satisfies Record<
	DashboardCardHeight,
	number
>

export const DASHBOARD_CARD_HEIGHT_LABELS = {
	compact: 'Compact',
	default: 'Default',
	tall: 'Tall'
} as const satisfies Record<DashboardCardHeight, string>

const SUPPORTS_CARD_HEIGHT_BY_ITEM_KIND = {
	chart: true,
	multi: true,
	builder: true,
	yields: true,
	stablecoins: true,
	'stablecoin-asset': true,
	'advanced-tvl': true,
	'advanced-borrowed': true,
	'income-statement': true,
	'unlocks-schedule': true,
	'unlocks-pie': true,
	'llamaai-chart': true,
	'rwa-overview': true,
	'rwa-asset': true,
	sql: true,
	'unified-table': true,
	'dataset-table': true,
	'custom-data': true,
	metric: false,
	text: false,
	section: false
} satisfies Record<DashboardItemConfig['kind'], boolean>

export function dashboardItemSupportsHeight(item: Pick<DashboardItemConfig, 'kind'>) {
	return SUPPORTS_CARD_HEIGHT_BY_ITEM_KIND[item.kind]
}

export function getDashboardItemHeight(item: DashboardItemConfig): DashboardCardHeight {
	return 'height' in item && item.height !== undefined && dashboardItemSupportsHeight(item) ? item.height : 'default'
}

export function getCardHeightScale(height: DashboardCardHeight | undefined): number {
	return DASHBOARD_CARD_HEIGHT_SCALE[height ?? 'default']
}

export function cardScaleStyle(height: DashboardCardHeight | undefined): CSSProperties | undefined {
	const scale = getCardHeightScale(height)
	return scale === 1 ? undefined : ({ '--card-scale': scale } as CSSProperties)
}

export function scaledCardHeight(base: number, height: DashboardCardHeight | undefined): number {
	return Math.round(base * getCardHeightScale(height))
}

export function getDashboardItemLayout(item: DashboardItemConfig): DashboardItemLayout {
	if (item.kind === 'section') return {}
	return {
		...(item.colSpan === undefined ? {} : { colSpan: item.colSpan }),
		...(item.height === undefined ? {} : { height: item.height })
	}
}

const SECTION_ROW_MIN_HEIGHT = 56
const EMBED_CARD_CHROME_HEIGHT = 54
const DEFAULT_CARD_BASE_HEIGHT = 360
const CARD_BASE_HEIGHT_BY_KIND: Partial<Record<DashboardItemConfig['kind'], number>> = {
	metric: 140,
	multi: 418,
	builder: 438,
	'unified-table': 380,
	'custom-data': 432,
	sql: 432
}

function scaledBaseCardHeight(item: DashboardItemConfig): number {
	return scaledCardHeight(CARD_BASE_HEIGHT_BY_KIND[item.kind] ?? DEFAULT_CARD_BASE_HEIGHT, getDashboardItemHeight(item))
}

export function getReadOnlyCardMinHeight(item: DashboardItemConfig): number {
	return item.kind === 'section' ? SECTION_ROW_MIN_HEIGHT : scaledBaseCardHeight(item)
}

export function getEmbedCardHeight(item: DashboardItemConfig | undefined): number {
	if (!item) return DEFAULT_CARD_BASE_HEIGHT + EMBED_CARD_CHROME_HEIGHT
	return scaledBaseCardHeight(item) + EMBED_CARD_CHROME_HEIGHT
}
