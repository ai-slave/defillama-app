import { useRef } from 'react'
import { Icon } from '~/ui/Icon'
import type { Dashboard } from '../dashboardTypes'
import { ProButton, proPanelStyles } from '../ui'
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
	const listRef = useRef<HTMLDivElement>(null)
	if (isLoading) {
		return <LoadingSkeleton viewMode="grid" items={8} />
	}

	return (
		<div ref={listRef} tabIndex={-1} aria-label="Your dashboards">
			{dashboards.length === 0 && emptyMessage ? (
				<div className={`${proPanelStyles} flex flex-1 flex-col items-center justify-center gap-2 py-12`}>
					<Icon name="search" height={32} width={32} className="text-pro-text-tertiary" />
					<p className="text-center text-sm text-pro-text-secondary">{emptyMessage.title}</p>
					<ProButton type="button" variant="secondary" onClick={emptyMessage.onClearFilters}>
						Clear filters
					</ProButton>
				</div>
			) : dashboards.length === 0 ? (
				<div className={`${proPanelStyles} flex flex-1 flex-col items-center justify-center gap-2 py-12`}>
					<Icon name="layers" height={32} width={32} className="text-pro-text-tertiary" />
					<h2 className="text-center text-base font-semibold text-pro-text-primary">No dashboards yet</h2>
					<p className="text-center text-sm text-pro-text-secondary">Create your first dashboard to get started</p>
					<ProButton type="button" variant="primary" size="lg" onClick={onCreateNew}>
						<Icon name="plus" height={16} width={16} />
						Create dashboard
					</ProButton>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
					{dashboards.map((dashboard) => (
						<DashboardCard
							fallbackFocus={listRef}
							key={dashboard.id}
							dashboard={dashboard}
							onDelete={onDeleteDashboard}
							viewMode="grid"
						/>
					))}
				</div>
			)}
		</div>
	)
}
