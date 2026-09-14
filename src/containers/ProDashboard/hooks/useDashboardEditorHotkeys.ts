import { useEffect } from 'react'

export interface DashboardEditorHotkeysOptions {
	enabled: boolean
	undo: () => boolean
	redo: () => boolean
	openQuickAdd: () => void
}

const EDITABLE_TARGET_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'
const OVERLAY_ANCESTOR_SELECTOR = '[role="dialog"], [role="menu"], [role="listbox"], [role="combobox"]'
const DIALOG_ANCESTOR_SELECTOR = '[role="dialog"]'

export type DashboardEditorHotkey = 'undo' | 'redo' | 'quick-add' | 'swallow-quick-add'

function isEventTargetReservedForTyping(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false
	return target.matches(EDITABLE_TARGET_SELECTOR) || target.closest(OVERLAY_ANCESTOR_SELECTOR) !== null
}

function isEventTargetInsideDialog(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false
	return target.closest(DIALOG_ANCESTOR_SELECTOR) !== null
}

function isQuickAddKey(event: KeyboardEvent): boolean {
	return event.code === 'KeyK' || event.key.toLowerCase() === 'k'
}

export function resolveDashboardEditorHotkey(event: KeyboardEvent): DashboardEditorHotkey | null {
	if (event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return null
	if (isQuickAddKey(event) && !event.shiftKey) {
		if (isEventTargetInsideDialog(event.target)) return 'swallow-quick-add'
		return isEventTargetReservedForTyping(event.target) ? null : 'quick-add'
	}
	if (isEventTargetReservedForTyping(event.target)) return null
	const key = event.key.toLowerCase()
	if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
	if (key === 'y' && !event.shiftKey) return 'redo'
	return null
}

export function useDashboardEditorHotkeys({ enabled, undo, redo, openQuickAdd }: DashboardEditorHotkeysOptions) {
	useEffect(() => {
		if (!enabled) return
		const handleKeyDown = (event: KeyboardEvent) => {
			const hotkey = resolveDashboardEditorHotkey(event)
			if (hotkey === null) return
			if (hotkey === 'quick-add' || hotkey === 'swallow-quick-add') {
				event.preventDefault()
				event.stopImmediatePropagation()
				if (hotkey === 'quick-add') openQuickAdd()
				return
			}
			const handled = hotkey === 'undo' ? undo() : redo()
			if (handled) event.preventDefault()
		}
		window.addEventListener('keydown', handleKeyDown, true)
		return () => window.removeEventListener('keydown', handleKeyDown, true)
	}, [enabled, undo, redo, openQuickAdd])
}
