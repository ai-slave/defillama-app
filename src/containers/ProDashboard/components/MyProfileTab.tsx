import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { getAuthorBySlug, getMyDashboardAuthorProfile } from '~/containers/Authors/api'
import { AuthorProfileView } from '~/containers/Authors/AuthorProfileView'
import type { AuthorDashboardSort } from '~/containers/Authors/types'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { mergeFailedReads, queryReadFailed } from '~/utils/query'

const DASHBOARD_LIMIT = 24

export function MyProfileTab() {
	const { authorizedFetch, isAuthenticated, loaders, user } = useAuthContext()
	const [dashboardPage, setDashboardPage] = useState(1)
	const [dashboardSort, setDashboardSort] = useState<AuthorDashboardSort>('recent')

	const profileQuery = useQuery({
		queryKey: ['dashboard-author-profile', user?.id],
		queryFn: () => getMyDashboardAuthorProfile(authorizedFetch),
		enabled: isAuthenticated && !loaders.userLoading && !!user?.id,
		retry: false,
		refetchOnWindowFocus: false
	})
	const slug = profileQuery.data?.slug

	const pageQuery = useQuery({
		queryKey: ['author-page', slug, dashboardPage, dashboardSort, user?.id],
		queryFn: () =>
			getAuthorBySlug(slug!, { dashboardPage, dashboardLimit: DASHBOARD_LIMIT, dashboardSort }, authorizedFetch),
		enabled: !!slug && isAuthenticated,
		staleTime: 60_000,
		retry: false,
		refetchOnWindowFocus: false
	})

	const failedRead = mergeFailedReads([
		queryReadFailed(profileQuery) ? profileQuery : null,
		queryReadFailed(pageQuery) ? pageQuery : null
	])
	if (failedRead) {
		return (
			<PanelStatus variant="error" retry={failedRead}>
				Couldn&apos;t load your profile.
			</PanelStatus>
		)
	}

	const view = pageQuery.data
	if (!view) return <PanelLoadingStatus label="Loading profile" />

	return (
		<AuthorProfileView
			view={view}
			sort={dashboardSort}
			isOwnProfile
			navigate={(params) => {
				if (params.sort && params.sort !== dashboardSort) {
					setDashboardSort(params.sort)
					setDashboardPage(1)
					return
				}
				if (params.page) setDashboardPage(params.page)
			}}
		/>
	)
}
