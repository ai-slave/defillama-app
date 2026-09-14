import { createContext, useContext } from 'react'
import type { StoredColSpan } from '../dashboardConfig/colSpan'
import type { DashboardCardHeight } from '../types'

export interface DashboardCardLayoutControls {
	colSpan: StoredColSpan
	colSpanOptions: ReadonlyArray<StoredColSpan>
	onColSpanChange: (colSpan: StoredColSpan) => void
	height: DashboardCardHeight | null
	heightOptions: ReadonlyArray<DashboardCardHeight>
	onHeightChange: (height: DashboardCardHeight) => void
	canMoveUp: boolean
	canMoveDown: boolean
	onMove: (direction: -1 | 1) => void
}

export interface DashboardCardContextValue {
	itemId: string
	layout?: DashboardCardLayoutControls | undefined
	onEdit?: (() => void) | undefined
	onRemove?: (() => void) | undefined
}

export const DashboardCardContext = createContext<DashboardCardContextValue | null>(null)

export function useDashboardCardContext() {
	return useContext(DashboardCardContext)
}
