import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { EmptyState } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { useLikedDashboards } from '../hooks/useLikedDashboards'
import { DashboardCard } from './DashboardCard'
import { LoadingSkeleton } from './LoadingSkeleton'

export function LikedDashboards() {
	const { dashboards, isLoading, page, totalPages, goToPage } = useLikedDashboards()

	if (isLoading && dashboards.length === 0) {
		return <LoadingSkeleton viewMode="grid" items={8} />
	}

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

			{totalPages > 1 ? (
				<div className="mt-8 flex items-center justify-center gap-1">
					<Tooltip
						content="Previous page"
						render={
							<Button
								size="md"
								type="button"
								square
								variant="ghost"
								aria-label="Previous page"
								onClick={() => goToPage(Math.max(1, page - 1))}
								disabled={page === 1}
								accessibleWhenDisabled
							/>
						}
					>
						<Icon name="chevron-left" className="size-4" />
					</Tooltip>

					{Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
						let pageNum = i + 1
						if (totalPages > 5 && page > 3) {
							pageNum = page - 2 + i
							if (pageNum > totalPages) {
								pageNum = totalPages - 4 + i
							}
						}
						return (
							<Button
								size="md"
								type="button"
								variant="ghost"
								data-active={page === pageNum}
								key={pageNum}
								onClick={() => goToPage(pageNum)}
								{...(page === pageNum ? { 'aria-current': 'page' as const } : {})}
							>
								{pageNum}
							</Button>
						)
					})}

					<Tooltip
						content="Next page"
						render={
							<Button
								size="md"
								type="button"
								square
								variant="ghost"
								aria-label="Next page"
								onClick={() => goToPage(Math.min(totalPages, page + 1))}
								disabled={page === totalPages}
								accessibleWhenDisabled
							/>
						}
					>
						<Icon name="chevron-right" className="size-4" />
					</Tooltip>
				</div>
			) : null}
		</div>
	)
}
