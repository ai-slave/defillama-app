import type { ParsedUrlQuery } from 'node:querystring'
import { readSingleQueryValue } from '~/utils/routerQuery'

export const TOKENS_PAGE_VIEWS = ['table', 'map', 'movers'] as const
export const TOKENS_UNIVERSES = ['100', '200', '300'] as const
export const TOKENS_CHANGE_WINDOWS = ['24h', '7d', '30d'] as const
export const TOKENS_MAP_MODES = ['grouped', 'flat'] as const
export const TOKENS_MOVERS_WINDOWS = ['24h', '7d', '30d'] as const

export type TokensPageView = (typeof TOKENS_PAGE_VIEWS)[number]
export type TokensUniverse = (typeof TOKENS_UNIVERSES)[number]
export type TokensChangeWindow = (typeof TOKENS_CHANGE_WINDOWS)[number]
export type TokensMapMode = (typeof TOKENS_MAP_MODES)[number]
export type TokensMoversWindow = (typeof TOKENS_MOVERS_WINDOWS)[number]

export const TOKENS_UNIVERSE_SIZE: Record<TokensUniverse, number> = {
	'100': 100,
	'200': 200,
	'300': 300
}

export interface TokensChartState {
	view: TokensPageView
	universe: TokensUniverse
	colorBy: TokensChangeWindow
	mapMode: TokensMapMode
	moversWindow: TokensMoversWindow
}

export const TOKENS_CHART_DEFAULTS: TokensChartState = {
	view: 'table',
	universe: '100',
	colorBy: '24h',
	mapMode: 'grouped',
	moversWindow: '24h'
}

export const TOKENS_CHART_QUERY_KEYS: Record<keyof TokensChartState, string> = {
	view: 'view',
	universe: 'chartTop',
	colorBy: 'colorBy',
	mapMode: 'mapMode',
	moversWindow: 'moversWindow'
}

function normalize<T extends string>(value: string | undefined, allowed: ReadonlyArray<T>, fallback: T): T {
	return value && allowed.includes(value as T) ? (value as T) : fallback
}

export function parseTokensChartState(query: ParsedUrlQuery): TokensChartState {
	return {
		view: normalize(readSingleQueryValue(query.view), TOKENS_PAGE_VIEWS, TOKENS_CHART_DEFAULTS.view),
		universe: normalize(readSingleQueryValue(query.chartTop), TOKENS_UNIVERSES, TOKENS_CHART_DEFAULTS.universe),
		colorBy: normalize(readSingleQueryValue(query.colorBy), TOKENS_CHANGE_WINDOWS, TOKENS_CHART_DEFAULTS.colorBy),
		mapMode: normalize(readSingleQueryValue(query.mapMode), TOKENS_MAP_MODES, TOKENS_CHART_DEFAULTS.mapMode),
		moversWindow: normalize(
			readSingleQueryValue(query.moversWindow),
			TOKENS_MOVERS_WINDOWS,
			TOKENS_CHART_DEFAULTS.moversWindow
		)
	}
}

export function getTokensChartQueryValue<K extends keyof TokensChartState>(
	key: K,
	value: TokensChartState[K]
): string | undefined {
	return value === TOKENS_CHART_DEFAULTS[key] ? undefined : value
}
