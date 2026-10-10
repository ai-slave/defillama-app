import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { EmptyState } from '~/ui/Status'
import type { Dashboard } from '../dashboardTypes'
import { ProButton } from '../ui'
import { DashboardCard } from './DashboardCard'
import { LoadingSkeleton } from './LoadingSkeleton'

interface DashboardListProps {
	dashboards: Array<Dashboard>
	isLoading: boolean
	onCreateNew: () => void
	onDeleteDashboard?: (dashboardId: string) => Promise<void>
	emptyMessage?: { title: string; onClearFilters: () => void }
}

export function DashboardList({
	dashboards,
	isLoading,
	onCreateNew,
	onDeleteDashboard,
	emptyMessage
}: DashboardListProps) {
	if (isLoading) {
		return <LoadingSkeleton viewMode="grid" items={8} />
	}

	return (
		<div>
			{dashboards.length === 0 && emptyMessage ? (
				<EmptyState
					size="lg"
					icon="search"
					title={emptyMessage.title}
					headingAs="h2"
					framed
					actions={
						<Button size="md" type="button" variant="secondary" onClick={emptyMessage.onClearFilters}>
							Clear filters
						</Button>
					}
				/>
			) : dashboards.length === 0 ? (
				<EmptyState
					size="lg"
					icon="layers"
					title="No dashboards yet"
					headingAs="h2"
					framed
					actions={
						<ProButton type="button" variant="primary" size="md" onClick={onCreateNew}>
							<Icon name="plus" height={14} width={14} />
							Create dashboard
						</ProButton>
					}
				>
					Create your first dashboard to get started.
				</EmptyState>
			) : (
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
					{dashboards.map((dashboard) => (
						<DashboardCard key={dashboard.id} dashboard={dashboard} onDelete={onDeleteDashboard} viewMode="grid" />
					))}
				</div>
			)}
		</div>
	)
}
