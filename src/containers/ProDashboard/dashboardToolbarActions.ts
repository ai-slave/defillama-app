export type DashboardToolbarActionId =
	| 'add-card'
	| 'add-section'
	| 'edit-with-ai'
	| 'undo-ai'
	| 'undo'
	| 'redo'
	| 'refresh-sql'

export interface DashboardToolbarActionState {
	isReadOnly: boolean
	hasAnyItems: boolean
	canUndoAi: boolean
	canUndoEdit: boolean
	canRedoEdit: boolean
	showSqlRefresh: boolean
	isLoadingEdits: boolean
}

const PHONE_MENU_ORDER: ReadonlyArray<DashboardToolbarActionId> = [
	'add-card',
	'add-section',
	'edit-with-ai',
	'undo-ai',
	'undo',
	'redo',
	'refresh-sql'
]

export const DESKTOP_TOOLBAR_ORDER: ReadonlyArray<DashboardToolbarActionId> = [
	'refresh-sql',
	'undo',
	'redo',
	'undo-ai',
	'edit-with-ai',
	'add-section',
	'add-card'
]

function isToolbarActionVisible(id: DashboardToolbarActionId, state: DashboardToolbarActionState): boolean {
	const canEdit = !state.isReadOnly
	const canAct = canEdit || state.isLoadingEdits
	switch (id) {
		case 'add-card':
			return canAct
		case 'add-section':
			return canAct && state.hasAnyItems
		case 'edit-with-ai':
			return canEdit && state.hasAnyItems
		case 'undo-ai':
			return canEdit && state.hasAnyItems && state.canUndoAi
		case 'undo':
			return canEdit && state.hasAnyItems && state.canUndoEdit
		case 'redo':
			return canEdit && state.hasAnyItems && state.canRedoEdit
		case 'refresh-sql':
			return state.showSqlRefresh
	}
}

export function visibleDashboardToolbarActions(state: DashboardToolbarActionState): Array<DashboardToolbarActionId> {
	return PHONE_MENU_ORDER.filter((id) => isToolbarActionVisible(id, state))
}

export interface DesktopToolbarAction {
	id: DashboardToolbarActionId
	disabled: boolean
}

export function desktopDashboardToolbarActions(state: DashboardToolbarActionState): Array<DesktopToolbarAction> {
	return DESKTOP_TOOLBAR_ORDER.filter((id) =>
		id === 'undo' || id === 'redo' ? !state.isReadOnly : isToolbarActionVisible(id, state)
	).map((id) => ({
		id,
		disabled: (id === 'undo' && !state.canUndoEdit) || (id === 'redo' && !state.canRedoEdit)
	}))
}
