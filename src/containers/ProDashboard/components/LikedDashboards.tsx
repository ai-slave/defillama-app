import { BasicLink } from '~/components/Link'
import { TablePager } from '~/components/Table/TablePager'
import { Button } from '~/ui/Button'
import { EmptyState, PanelStatus } from '~/ui/Status'
import { useLikedDashboards } from '../hooks/useLikedDashboards'
import { DashboardCard } from './DashboardCard'
import { LoadingSkeleton } from './LoadingSkeleton'

export function LikedDashboards() {
	const { dashboards, isLoading, isFetching, readFailed, page, totalPages, refetch, goToPage } = useLikedDashboards()

	if (readFailed) {
		return (
			<PanelStatus variant="error" retry={{ refetch, isFetching }}>
				Couldn&apos;t load your starred dashboards.
			</PanelStatus>
		)
	}

	if (isLoading) {
		return <LoadingSkeleton viewMode="grid" items={8} />
	}

	// Unstarring the last dashboard on a later page lands here, not on the page before, and the pager goes with the list.
	// Accepted: it takes emptying a whole later page, and stepping back would mean holding the page count through a refetch.
	if (dashboards.length === 0) {
		return (
			<EmptyState
				size="lg"
				icon="star"
				title="No starred dashboards yet"
				headingAs="h2"
				framed
				actions={
					<Button as={BasicLink} href="/pro?tab=discover" size="md" variant="secondary">
						Browse dashboards
					</Button>
				}
			>
				Dashboards you star show up here.
			</EmptyState>
		)
	}

	return (
		<div>
			<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
				{dashboards.map((dashboard) => (
					<DashboardCard key={dashboard.id} dashboard={dashboard} viewMode="grid" />
				))}
			</div>

			<TablePager
				pageIndex={page - 1}
				pageCount={totalPages}
				onPageChange={(pageIndex) => goToPage(pageIndex + 1)}
				className="mt-8 justify-center"
			/>
		</div>
	)
}
