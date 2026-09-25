import { expect, test } from 'vitest'
import {
	desktopDashboardToolbarActions,
	type DashboardToolbarActionState,
	visibleDashboardToolbarActions
} from '../dashboardToolbarActions'

const editorWithEverything: DashboardToolbarActionState = {
	isReadOnly: false,
	hasAnyItems: true,
	canUndoAi: true,
	canUndoEdit: true,
	canRedoEdit: true,
	hasDashboardId: true,
	showSqlRefresh: true,
	isLoadingEdits: false
}

test('a viewer without SQL cards gets no toolbar actions', () => {
	expect(visibleDashboardToolbarActions({ ...editorWithEverything, isReadOnly: true, showSqlRefresh: false })).toEqual(
		[]
	)
})

test('a viewer keeps the SQL refresh the dashboard needs', () => {
	expect(visibleDashboardToolbarActions({ ...editorWithEverything, isReadOnly: true })).toEqual(['refresh-sql'])
})

test('an editor with everything available lists the actions in sheet order', () => {
	expect(visibleDashboardToolbarActions(editorWithEverything)).toEqual([
		'add-card',
		'add-section',
		'edit-with-ai',
		'undo-ai',
		'undo',
		'redo',
		'refresh-sql',
		'settings'
	])
})

test('an empty dashboard offers only the card and settings entry points', () => {
	expect(
		visibleDashboardToolbarActions({ ...editorWithEverything, hasAnyItems: false, showSqlRefresh: false })
	).toEqual(['add-card', 'settings'])
})

test('an unsaved dashboard has no settings to open yet', () => {
	expect(
		visibleDashboardToolbarActions({ ...editorWithEverything, hasAnyItems: false, hasDashboardId: false })
	).toEqual(['add-card', 'refresh-sql'])
})

test('a dashboard still loading its edits keeps the card actions reachable while read-only', () => {
	expect(
		visibleDashboardToolbarActions({
			...editorWithEverything,
			isReadOnly: true,
			isLoadingEdits: true,
			showSqlRefresh: false
		})
	).toEqual(['add-card', 'add-section', 'settings'])
})

test('history actions appear only once their direction is available', () => {
	expect(
		visibleDashboardToolbarActions({
			...editorWithEverything,
			canUndoAi: false,
			canUndoEdit: false,
			canRedoEdit: false,
			showSqlRefresh: false
		})
	).toEqual(['add-card', 'add-section', 'edit-with-ai', 'settings'])
})

test('the desktop row keeps undo and redo mounted and disables the unavailable direction', () => {
	expect(
		desktopDashboardToolbarActions({
			...editorWithEverything,
			canUndoAi: false,
			canUndoEdit: false,
			canRedoEdit: false,
			hasAnyItems: false,
			showSqlRefresh: false
		})
	).toEqual([
		{ id: 'undo', disabled: true },
		{ id: 'redo', disabled: true },
		{ id: 'add-card', disabled: false }
	])
})

test('the desktop row disables only the direction that ran out', () => {
	expect(
		desktopDashboardToolbarActions({ ...editorWithEverything, canRedoEdit: false, showSqlRefresh: false })
	).toEqual([
		{ id: 'undo', disabled: false },
		{ id: 'redo', disabled: true },
		{ id: 'undo-ai', disabled: false },
		{ id: 'edit-with-ai', disabled: false },
		{ id: 'add-section', disabled: false },
		{ id: 'add-card', disabled: false }
	])
})

test('a viewer gets no history controls on the desktop row', () => {
	expect(desktopDashboardToolbarActions({ ...editorWithEverything, isReadOnly: true })).toEqual([
		{ id: 'refresh-sql', disabled: false }
	])
})
