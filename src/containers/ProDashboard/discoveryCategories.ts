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
	{ key: 'trendingToday', title: 'Trending Today', sortBy: 'trending', timeFrame: '1d', limit: 8 },
	{ key: 'trendingWeek', title: 'Trending This Week', sortBy: 'trending', timeFrame: '7d', limit: 8 },
	{ key: 'popular', title: 'Most Popular', sortBy: 'popular', limit: 8 },
	{ key: 'recent', title: 'Recently Created', sortBy: 'recent', limit: 8 }
]
