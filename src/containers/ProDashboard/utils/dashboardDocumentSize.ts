import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { AIUndoState, DashboardAnnotation, DashboardVariable } from '../dashboardTypes'
import { toPersistedDashboardItems } from './dashboardUtils'

const DASHBOARD_DATA_LENGTH_LIMIT = 900_000

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

function formatDashboardDataLength(length: number): string {
	return `${Math.round(length / 1024)} KB`
}

/** The message shown when saving `document` would pass the stored dashboard size limit, or null when it fits. */
export function getDashboardSizeLimitError(document: DashboardDocumentInput): string | null {
	const length = estimateDashboardDataLength(document)
	if (length <= DASHBOARD_DATA_LENGTH_LIMIT) return null
	return `Dashboard is too large (${formatDashboardDataLength(length)}). Remove rows or a card.`
}
