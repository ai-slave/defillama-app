import type { ParsedUrlQuery } from 'node:querystring'
import { readSingleQueryValue } from '~/utils/routerQuery'
import {
	EQUITIES_TREEMAP_COLOR_METRICS,
	EQUITIES_TREEMAP_SIZE_METRICS,
	type EquitiesTreemapColorMetric,
	type EquitiesTreemapGroupBy,
	type EquitiesTreemapSizeMetric
} from './treemapData'

export const EQUITIES_PAGE_VIEWS = ['table', 'map'] as const
export type EquitiesPageView = (typeof EQUITIES_PAGE_VIEWS)[number]

const EQUITIES_TREEMAP_GROUPS = ['sector', 'none'] as const satisfies ReadonlyArray<EquitiesTreemapGroupBy>

export interface EquitiesTreemapState {
	view: EquitiesPageView
	groupBy: EquitiesTreemapGroupBy
	sizeMetric: EquitiesTreemapSizeMetric
	colorMetric: EquitiesTreemapColorMetric
}

export const EQUITIES_TREEMAP_DEFAULTS: EquitiesTreemapState = {
	view: 'table',
	groupBy: 'sector',
	sizeMetric: 'marketCap',
	colorMetric: 'priceChangePercentage1d'
}

export const EQUITIES_TREEMAP_QUERY_KEYS: Record<keyof EquitiesTreemapState, string> = {
	view: 'view',
	groupBy: 'mapGroup',
	sizeMetric: 'mapSize',
	colorMetric: 'mapColor'
}

function normalize<T extends string>(value: string | undefined, allowed: ReadonlyArray<T>, fallback: T): T {
	return value && allowed.includes(value as T) ? (value as T) : fallback
}

export function parseEquitiesTreemapState(query: ParsedUrlQuery): EquitiesTreemapState {
	return {
		view: normalize(readSingleQueryValue(query.view), EQUITIES_PAGE_VIEWS, EQUITIES_TREEMAP_DEFAULTS.view),
		groupBy: normalize(
			readSingleQueryValue(query.mapGroup),
			EQUITIES_TREEMAP_GROUPS,
			EQUITIES_TREEMAP_DEFAULTS.groupBy
		),
		sizeMetric: normalize(
			readSingleQueryValue(query.mapSize),
			EQUITIES_TREEMAP_SIZE_METRICS,
			EQUITIES_TREEMAP_DEFAULTS.sizeMetric
		),
		colorMetric: normalize(
			readSingleQueryValue(query.mapColor),
			EQUITIES_TREEMAP_COLOR_METRICS,
			EQUITIES_TREEMAP_DEFAULTS.colorMetric
		)
	}
}

export function getEquitiesTreemapQueryValue<K extends keyof EquitiesTreemapState>(
	key: K,
	value: EquitiesTreemapState[K]
): string | undefined {
	return value === EQUITIES_TREEMAP_DEFAULTS[key] ? undefined : value
}
