import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { UnifiedCitationReference } from '~/containers/LlamaAI/types'

export interface CitationSheetValue {
	activeRef: UnifiedCitationReference | null
	isOpen: boolean
	open: (reference: UnifiedCitationReference) => void
	close: () => void
	/** Focuses the control that opened the panel. */
	restoreFocus: () => void
}

const CitationSheetContext = createContext<CitationSheetValue | null>(null)

/** The open citation belongs to the chat it was opened in: switching chats closes it in the same render. */
export function useCitationSheetController(sessionId: string | null): CitationSheetValue {
	const [opened, setOpened] = useState<{ reference: UnifiedCitationReference; sessionId: string | null } | null>(null)
	// Dropped rather than hidden, so coming back to the first chat does not reopen it.
	if (opened && opened.sessionId !== sessionId) setOpened(null)
	const activeRef = opened?.reference ?? null
	const triggerRef = useRef<HTMLElement | null>(null)
	const open = useCallback(
		(reference: UnifiedCitationReference) => {
			// A citation opened from inside the panel keeps the control that first opened it.
			const active = document.activeElement
			if (active instanceof HTMLElement && !active.closest('[data-citation-panel]')) triggerRef.current = active
			setOpened({ reference, sessionId })
		},
		[sessionId]
	)
	const close = useCallback(() => setOpened(null), [])
	const restoreFocus = useCallback(() => triggerRef.current?.focus(), [])
	return useMemo(
		() => ({ activeRef, isOpen: activeRef !== null, open, close, restoreFocus }),
		[activeRef, open, close, restoreFocus]
	)
}

export function CitationSheetProvider({ value, children }: { value: CitationSheetValue; children: ReactNode }) {
	return <CitationSheetContext.Provider value={value}>{children}</CitationSheetContext.Provider>
}

export function useCitationSheet(): CitationSheetValue {
	const ctx = useContext(CitationSheetContext)
	return ctx ?? { activeRef: null, isOpen: false, open: () => {}, close: () => {}, restoreFocus: () => {} }
}
