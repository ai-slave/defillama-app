import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { useLikedDashboards } from '../hooks/useLikedDashboards'
import { proPanelStyles } from '../ui'
import { DashboardCard } from './DashboardCard'
import { LoadingSkeleton } from './LoadingSkeleton'

export function LikedDashboards() {
	const { dashboards, isLoading, page, totalPages, goToPage } = useLikedDashboards()

	if (isLoading && dashboards.length === 0) {
		return <LoadingSkeleton viewMode="grid" items={8} />
	}

	if (dashboards.length === 0) {
		return (
			<div className={`${proPanelStyles} flex flex-1 flex-col items-center justify-center gap-2 py-12`}>
				<Icon name="star" height={32} width={32} className="text-pro-text-tertiary" />
				<h2 className="text-center title-lg text-pro-text-primary">No starred dashboards yet</h2>
				<p className="text-center text-sm text-pro-text-secondary">Dashboards you star show up here.</p>
				<div className="mt-7">
					<Button as={BasicLink} href="/pro?tab=discover" size="md" variant="secondary">
						Browse dashboards
					</Button>
				</div>
			</div>
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
						<Icon name="chevron-left" height={16} width={16} />
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
						<Icon name="chevron-right" height={16} width={16} />
					</Tooltip>
				</div>
			) : null}
		</div>
	)
}
