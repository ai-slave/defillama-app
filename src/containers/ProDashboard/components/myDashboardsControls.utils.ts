import { parseDateTimestamp } from '~/utils/dateFormat'
import type { Dashboard } from '../dashboardTypes'

export const MY_DASHBOARDS_SORT_OPTIONS = [
	{ key: 'recent', name: 'Recently edited' },
	{ key: 'name', name: 'Name A–Z' },
	{ key: 'views', name: 'Most viewed' }
] as const

export type MyDashboardsSort = (typeof MY_DASHBOARDS_SORT_OPTIONS)[number]['key']

export const MY_DASHBOARDS_VISIBILITY_OPTIONS = [
	{ value: 'all', label: 'All' },
	{ value: 'public', label: 'Public' },
	{ value: 'private', label: 'Private' }
] as const

export type MyDashboardsVisibility = (typeof MY_DASHBOARDS_VISIBILITY_OPTIONS)[number]['value']

export interface MyDashboardsControlsState {
	query: string
	sort: MyDashboardsSort
	visibility: MyDashboardsVisibility
}

export const DEFAULT_MY_DASHBOARDS_CONTROLS: MyDashboardsControlsState = {
	query: '',
	sort: 'recent',
	visibility: 'all'
}

export const MY_DASHBOARDS_FILTERED_PAGE_SIZE = 100

export function isMyDashboardsSort(value: string): value is MyDashboardsSort {
	return MY_DASHBOARDS_SORT_OPTIONS.some((option) => option.key === value)
}

export function areMyDashboardsControlsActive(state: MyDashboardsControlsState): boolean {
	return (
		state.query.trim() !== '' ||
		state.sort !== DEFAULT_MY_DASHBOARDS_CONTROLS.sort ||
		state.visibility !== DEFAULT_MY_DASHBOARDS_CONTROLS.visibility
	)
}

/**
 * Active controls search and sort on the client, so they fetch the most recent dashboards in one
 * large first page instead of the selected server page.
 */
export function getMyDashboardsRequest(
	controls: MyDashboardsControlsState,
	selectedPage: number
): { page: number; limit: number } {
	if (areMyDashboardsControlsActive(controls)) return { page: 1, limit: MY_DASHBOARDS_FILTERED_PAGE_SIZE }
	return { page: selectedPage, limit: 20 }
}

function haystack(dashboard: Dashboard): string {
	return [dashboard.data?.dashboardName ?? '', dashboard.description ?? '', ...(dashboard.tags ?? [])]
		.join(' ')
		.toLowerCase()
}

function editedTimestamp(dashboard: Dashboard): number {
	const value = dashboard.editedAt || dashboard.updated
	return (value ? parseDateTimestamp(value) : null) ?? 0
}

function compare(a: Dashboard, b: Dashboard, sort: MyDashboardsSort): number {
	if (sort === 'name') {
		return (a.data?.dashboardName ?? '').localeCompare(b.data?.dashboardName ?? '', 'en', { sensitivity: 'base' })
	}
	if (sort === 'views') return (b.viewCount ?? 0) - (a.viewCount ?? 0)
	return editedTimestamp(b) - editedTimestamp(a)
}

export function filterAndSortMyDashboards(
	dashboards: ReadonlyArray<Dashboard>,
	{ query, sort, visibility }: MyDashboardsControlsState
): Array<Dashboard> {
	const needle = query.trim().toLowerCase()
	const matched = dashboards.filter((dashboard) => {
		if (visibility !== 'all' && (dashboard.visibility === 'public' ? 'public' : 'private') !== visibility) return false
		return needle === '' || haystack(dashboard).includes(needle)
	})
	return matched
		.map((dashboard, index) => ({ dashboard, index }))
		.sort((a, b) => compare(a.dashboard, b.dashboard, sort) || a.index - b.index)
		.map((entry) => entry.dashboard)
}
