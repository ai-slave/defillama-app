import type { ParsedUrlQuery } from 'querystring'
import {
	DWM_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { readSingleQueryValue } from '~/utils/routerQuery'

export type UpcomingUnlockChartType = 'all' | 'cliff' | 'linear'
export type UpcomingUnlockChartViewMode = 'Total View' | 'Breakdown View'

export const UPCOMING_UNLOCK_TYPE_HELP = {
	all: 'Cliff unlocks plus linear releases accrued within each chart bucket.',
	cliff: 'One-time token releases scheduled within this period.',
	linear: "Tokens released continuously during this period, calculated from each schedule's active emission rate."
} as const satisfies Record<UpcomingUnlockChartType, string>

export const UPCOMING_UNLOCK_TYPE_OPTIONS = [
	{ key: 'all', name: 'All Unlocks', help: UPCOMING_UNLOCK_TYPE_HELP.all },
	{ key: 'cliff', name: 'Cliff Unlocks', help: UPCOMING_UNLOCK_TYPE_HELP.cliff },
	{ key: 'linear', name: 'Linear Unlocks', help: UPCOMING_UNLOCK_TYPE_HELP.linear }
] as const satisfies ReadonlyArray<{ key: UpcomingUnlockChartType; name: string; help: string }>

export const UPCOMING_UNLOCK_VIEW_MODES = ['Total View', 'Breakdown View'] as const

export const UPCOMING_UNLOCK_CHART_QUERY_KEYS = {
	unlockType: 'chartUnlockType',
	groupBy: 'chartGroup',
	viewMode: 'chartView'
} as const

export type UpcomingUnlockChartState = {
	unlockType: UpcomingUnlockChartType
	groupBy: LowercaseDwmGrouping
	viewMode: UpcomingUnlockChartViewMode
}

export function parseUpcomingUnlockChartState(query: ParsedUrlQuery): UpcomingUnlockChartState {
	const unlockTypeValue = readSingleQueryValue(query[UPCOMING_UNLOCK_CHART_QUERY_KEYS.unlockType])
	const groupByValue = readSingleQueryValue(query[UPCOMING_UNLOCK_CHART_QUERY_KEYS.groupBy])?.toLowerCase()
	const viewModeValue = readSingleQueryValue(query[UPCOMING_UNLOCK_CHART_QUERY_KEYS.viewMode])

	return {
		unlockType: unlockTypeValue === 'cliff' || unlockTypeValue === 'linear' ? unlockTypeValue : 'all',
		groupBy: DWM_GROUPING_OPTIONS_LOWERCASE.find((option) => option.value === groupByValue)?.value ?? 'daily',
		viewMode: viewModeValue === 'breakdown' || viewModeValue === 'Breakdown View' ? 'Breakdown View' : 'Total View'
	}
}

export function getUpcomingUnlockTypeLabel(unlockType: UpcomingUnlockChartType) {
	if (unlockType === 'cliff') return 'Cliff Unlocks'
	if (unlockType === 'linear') return 'Linear Unlocks'
	return 'All Unlocks'
}

export function getUpcomingUnlockTypeQueryValue(unlockType: UpcomingUnlockChartType): string | undefined {
	return unlockType === 'all' ? undefined : unlockType
}

export function getUpcomingUnlockGroupByQueryValue(groupBy: LowercaseDwmGrouping): string | undefined {
	return groupBy === 'daily' ? undefined : groupBy
}

export function getUpcomingUnlockViewModeQueryValue(viewMode: UpcomingUnlockChartViewMode): string | undefined {
	return viewMode === 'Total View' ? undefined : 'breakdown'
}
