import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useAuthContext } from '~/auth'
import type { Dashboard } from '../dashboardTypes'
import { dashboardAPI } from '../services/DashboardAPI'
import { DashboardCard } from './DashboardCard'

const SIMILAR_QUERY_TAG_LIMIT = 2
const SIMILAR_FETCH_LIMIT = 9
const SIMILAR_DISPLAY_LIMIT = 4
const EMPTY_DASHBOARDS: Array<Dashboard> = []

interface SimilarDashboardsProps {
	dashboardId: string
	tags: ReadonlyArray<string>
}

export function SimilarDashboards({ dashboardId, tags }: SimilarDashboardsProps) {
	const router = useRouter()
	const { authorizedFetch, isAuthenticated } = useAuthContext()
	const queryTags = tags.slice(0, SIMILAR_QUERY_TAG_LIMIT)

	const { data } = useQuery({
		queryKey: ['pro-dashboard', 'similar', dashboardId, queryTags],
		queryFn: () =>
			dashboardAPI.searchDashboards(
				{
					tags: queryTags,
					visibility: 'public',
					sortBy: 'popular',
					page: 1,
					limit: SIMILAR_FETCH_LIMIT
				},
				isAuthenticated ? authorizedFetch : undefined
			),
		staleTime: 1000 * 60 * 5,
		enabled: queryTags.length > 0
	})

	const similarDashboards = (data?.items ?? EMPTY_DASHBOARDS)
		.filter((dashboard) => dashboard.id !== dashboardId)
		.slice(0, SIMILAR_DISPLAY_LIMIT)

	if (queryTags.length === 0 || similarDashboards.length === 0) return null

	const openTag = (tag: string) => {
		void router.push({ pathname: '/pro', query: { tab: 'discover', tag } })
	}

	return (
		<section aria-labelledby="similar-dashboards-heading" className="flex flex-col gap-3">
			<h2 id="similar-dashboards-heading" className="heading-xs text-primary">
				Similar dashboards
			</h2>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
				{similarDashboards.map((dashboard) => (
					<div
						key={dashboard.id}
						className="min-w-0"
						data-umami-event="dashboard-similar-click"
						data-umami-event-dashboard={dashboard.id}
					>
						<DashboardCard dashboard={dashboard} viewMode="grid" onTagClick={openTag} className="h-full" />
					</div>
				))}
			</div>
		</section>
	)
}
