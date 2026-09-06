import { useQueries } from '@tanstack/react-query'
import { useAuthContext } from '~/auth'
import type { Dashboard } from '../dashboardTypes'
import { DISCOVERY_CATEGORIES, type DiscoveryCategoriesInitialData } from '../discoveryCategories'
import { dashboardAPI } from '../services/DashboardAPI'

const EMPTY_DASHBOARDS: Array<Dashboard> = []

interface CategoryData {
	dashboards: Array<Dashboard>
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
						...(category.timeFrame ? { timeFrame: category.timeFrame } : {}),
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
		const query = queries[index]
		if (!category || !query) throw new Error(`Missing discovery category query ${index}`)
		categories[category.key] = {
			dashboards: query.data?.items ?? EMPTY_DASHBOARDS,
			isLoading: query.isLoading,
			error: query.error
		}
	}

	return {
		categories,
		isAnyLoading: queries.some((q) => q.isLoading)
	}
}
