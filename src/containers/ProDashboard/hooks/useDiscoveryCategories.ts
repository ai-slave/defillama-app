import { useQueries } from '@tanstack/react-query'
import { useAuthContext } from '~/auth'
import type { Dashboard } from '../dashboardTypes'
import {
	DISCOVERY_CATEGORIES,
	type DiscoveryCategoriesInitialData,
	type DiscoveryCategoryResponse
} from '../discoveryCategories'
import { dashboardAPI } from '../services/DashboardAPI'

export { DISCOVERY_CATEGORIES }
export type { DiscoveryCategoriesInitialData, DiscoveryCategoryResponse }

const EMPTY_DASHBOARDS: Dashboard[] = []

interface CategoryData {
	dashboards: Dashboard[]
	isLoading: boolean
	error: Error | null
}

export function useDiscoveryCategories(initialData?: DiscoveryCategoriesInitialData | null) {
	const { authorizedFetch, isAuthenticated } = useAuthContext()

	const queries = useQueries({
		queries: DISCOVERY_CATEGORIES.map((category) => ({
			queryKey: ['pro-dashboard', 'discovery-category', category.key, isAuthenticated],
			queryFn: async () => {
				return await dashboardAPI.searchDashboards(
					{
						visibility: 'public',
						sortBy: category.sortBy,
						timeFrame: category.timeFrame,
						page: 1,
						limit: category.limit
					},
					isAuthenticated ? authorizedFetch : undefined
				)
			},
			staleTime: 1000 * 60 * 5,
			initialData: initialData?.[category.key]
		}))
	})

	const categories: Record<string, CategoryData> = {}
	for (let index = 0; index < DISCOVERY_CATEGORIES.length; index++) {
		const category = DISCOVERY_CATEGORIES[index]
		categories[category.key] = {
			dashboards: queries[index].data?.items ?? EMPTY_DASHBOARDS,
			isLoading: queries[index].isLoading,
			error: queries[index].error as Error | null
		}
	}

	return {
		categories,
		isAnyLoading: queries.some((q) => q.isLoading)
	}
}
