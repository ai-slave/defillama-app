import type { Dashboard } from './dashboardTypes'

export interface DiscoveryCategoryConfig {
	key: string
	title: string
	sortBy: 'trending' | 'popular' | 'recent'
	timeFrame?: '1d' | '7d'
	limit: number
}

export interface DiscoveryCategoryResponse {
	items: Array<Dashboard>
	page: number
	perPage: number
	totalItems: number
	totalPages: number
	searchParams?: unknown
}

export type DiscoveryCategoriesInitialData = Record<string, DiscoveryCategoryResponse>

/** Public shelves shown on /pro. Audits may override `limit` without redefining the shelf semantics. */
export const DISCOVERY_CATEGORIES: Array<DiscoveryCategoryConfig> = [
	{ key: 'trendingToday', title: 'Trending today', sortBy: 'trending', timeFrame: '1d', limit: 12 },
	{ key: 'trendingWeek', title: 'Trending this week', sortBy: 'trending', timeFrame: '7d', limit: 12 },
	{ key: 'popular', title: 'Most popular', sortBy: 'popular', limit: 12 },
	{ key: 'recent', title: 'Recently created', sortBy: 'recent', limit: 12 }
]
