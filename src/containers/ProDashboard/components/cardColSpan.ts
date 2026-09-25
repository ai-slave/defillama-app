import type { StoredColSpan } from '../dashboardConfig/colSpan'
import type { DashboardItemConfig } from '../dashboardItemConfig'

const STORED_COL_SPANS = [0.5, 1, 1.5, 2] as const satisfies ReadonlyArray<StoredColSpan>
const METRIC_COL_SPANS = [0.5, 1] as const satisfies ReadonlyArray<StoredColSpan>
const NO_COL_SPANS: ReadonlyArray<StoredColSpan> = []

/** Dataset tables take the whole grid row whatever width is stored, so their columns stay readable. */
export function itemSpansFullRow(item: DashboardItemConfig): boolean {
	return item.kind === 'dataset-table'
}

/** Widths the card menu offers. Sections and dataset tables always span the whole grid. */
export function itemColSpanOptions(item: DashboardItemConfig): ReadonlyArray<StoredColSpan> {
	if (item.kind === 'section' || itemSpansFullRow(item)) return NO_COL_SPANS
	return item.kind === 'metric' ? METRIC_COL_SPANS : STORED_COL_SPANS
}

export function itemColSpan(item: DashboardItemConfig): StoredColSpan {
	if (item.kind === 'section') return 2
	return item.colSpan ?? (item.kind === 'metric' ? METRIC_COL_SPANS[0] : 1)
}

/** The stored half-width steps as columns of the four-column desktop grid. */
export function gridColumnSpan(span: StoredColSpan): 1 | 2 | 3 | 4 {
	if (span === 0.5) return 1
	if (span === 1) return 2
	if (span === 1.5) return 3
	return 4
}
