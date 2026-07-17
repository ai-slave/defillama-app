import { trackUmamiEvent } from './umami'

export const YIELDS_EVENTS = {
	// Filters
	FILTER_CHAIN: 'yields-filter-chain',
	FILTER_PROJECT: 'yields-filter-project',
	FILTER_CATEGORY: 'yields-filter-category',
	FILTER_ATTRIBUTE: 'yields-filter-attribute',
	FILTER_TVL_RANGE: 'yields-filter-tvl-range',
	FILTER_APY_RANGE: 'yields-filter-apy-range',
	FILTER_COLUMN: 'yields-filter-column',
	FILTER_PRESET: 'yields-filter-preset',
	// APY view controls
	APY_COMPONENT_TOGGLE: 'yields-apy-component-toggle',
	APY_WINDOW: 'yields-apy-window',
	// Saved Filters
	SAVED_FILTER_CREATE: 'yields-saved-filter-create',
	SAVED_FILTER_LOAD: 'yields-saved-filter-load',
	// Search (token search dialog)
	SEARCH_TOKEN_INCLUDE: 'yields-search-token-include',
	SEARCH_TOKEN_MATCH: 'yields-search-token-match',
	SEARCH_TOKEN_ON: 'yields-search-token-on',
	// Watchlist
	WATCHLIST_POOL_ADD: 'yields-watchlist-pool-add',
	// Table
	TABLE_SORT: 'yields-table-sort',
	// Pool
	POOL_CLICK: 'yields-pool-click',
	POOL_EXTERNAL_LINK: 'yields-pool-external-link',
	// Premium
	YIELD_SCORE_CLICK: 'yields-yield-score-click'
} as const

type YieldsEventName = (typeof YIELDS_EVENTS)[keyof typeof YIELDS_EVENTS]

export function trackYieldsEvent(eventName: YieldsEventName, data?: Record<string, string | number | boolean>): void {
	trackUmamiEvent(eventName, data)
}
