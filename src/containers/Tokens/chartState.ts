import type { ParsedUrlQuery } from 'querystring'
import { readSingleQueryValue } from '~/utils/routerQuery'

export const TOKENS_CHART_VIEWS = ['map', 'movers'] as const
export const TOKENS_UNIVERSES = ['100', '200', '300'] as const
export const TOKENS_CHANGE_WINDOWS = ['24h', '7d', '30d'] as const
export const TOKENS_MAP_MODES = ['grouped', 'flat'] as const
export const TOKENS_MOVERS_WINDOWS = ['24h', '7d', '30d'] as const

export type TokensChartView = (typeof TOKENS_CHART_VIEWS)[number]
export type TokensUniverse = (typeof TOKENS_UNIVERSES)[number]
export type TokensChangeWindow = (typeof TOKENS_CHANGE_WINDOWS)[number]
export type TokensMapMode = (typeof TOKENS_MAP_MODES)[number]
export type TokensMoversWindow = (typeof TOKENS_MOVERS_WINDOWS)[number]

export interface TokensChartState {
	view: TokensChartView
	universe: TokensUniverse
	colorBy: TokensChangeWindow
	mapMode: TokensMapMode
	moversWindow: TokensMoversWindow
}

export const TOKENS_CHART_DEFAULTS: TokensChartState = {
	view: 'map',
	universe: '100',
	colorBy: '24h',
	mapMode: 'grouped',
	moversWindow: '24h'
}

function normalize<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
	return value && allowed.includes(value as T) ? (value as T) : fallback
}

export function parseTokensChartState(query: ParsedUrlQuery): TokensChartState {
	return {
		view: normalize(readSingleQueryValue(query.chartView), TOKENS_CHART_VIEWS, TOKENS_CHART_DEFAULTS.view),
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
