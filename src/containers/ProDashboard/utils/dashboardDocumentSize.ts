import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { AIUndoState, DashboardAnnotation, DashboardVariable } from '../dashboardTypes'
import { toPersistedDashboardItems } from './dashboardUtils'

export const DASHBOARD_DATA_LENGTH_LIMIT = 900_000

export interface DashboardDocumentInput {
	items: Array<DashboardItemConfig>
	variables?: ReadonlyArray<DashboardVariable> | undefined
	annotations?: ReadonlyArray<DashboardAnnotation> | undefined
	aiUndoState?: AIUndoState | null | undefined
}

export function estimateDashboardDataLength({
	items,
	variables,
	annotations,
	aiUndoState
}: DashboardDocumentInput): number {
	return JSON.stringify({
		items: toPersistedDashboardItems(items),
		...(variables === undefined ? {} : { variables }),
		...(annotations === undefined ? {} : { annotations }),
		...(aiUndoState ? { aiUndoState: { ...aiUndoState, items: toPersistedDashboardItems(aiUndoState.items) } } : {})
	}).length
}

export function isDashboardDataTooLarge(input: DashboardDocumentInput): boolean {
	return estimateDashboardDataLength(input) > DASHBOARD_DATA_LENGTH_LIMIT
}

export function formatDashboardDataLength(length: number): string {
	return `${Math.round(length / 1024)} KB`
}
