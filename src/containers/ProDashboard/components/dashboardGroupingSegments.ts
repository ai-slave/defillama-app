import { capitalizeFirstLetter } from '~/utils'
import type { DashboardGrouping } from '../types'

export const DASHBOARD_GROUPINGS: Array<DashboardGrouping> = ['day', 'week', 'month', 'quarter', 'year']

export const DASHBOARD_GROUPING_LABELS: Record<DashboardGrouping, string> = {
	day: 'Daily',
	week: 'Weekly',
	month: 'Monthly',
	quarter: 'Quarterly',
	year: 'Yearly'
}

export const DASHBOARD_GROUPING_SEGMENTS = DASHBOARD_GROUPINGS.map((grouping) => ({
	value: grouping,
	label: grouping.slice(0, 1).toUpperCase(),
	ariaLabel: capitalizeFirstLetter(grouping),
	tooltip: capitalizeFirstLetter(grouping)
}))
