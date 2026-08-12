import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getStorageItem, removeStorageItem, setStorageItem, subscribeToStorageKey } from '~/contexts/localStorageStore'

export const LLAMA_AI_PROMPT_DRAFT_KEY = 'llamaai-prompt-draft'
const PROMPT_DRAFT_DEBOUNCE_MS = 300

export function usePromptDraft() {
	const [draft, setDraftState] = useState('')
	const pendingDraftRef = useRef<string | null>(null)
	const persistenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const cancelPendingPersistence = useCallback(() => {
		if (persistenceTimeoutRef.current != null) {
			clearTimeout(persistenceTimeoutRef.current)
			persistenceTimeoutRef.current = null
		}
	}, [])

	const flushPendingPersistence = useCallback(() => {
		cancelPendingPersistence()
		const pendingDraft = pendingDraftRef.current
		pendingDraftRef.current = null
		if (pendingDraft != null) {
			setStorageItem(LLAMA_AI_PROMPT_DRAFT_KEY, pendingDraft)
		}
	}, [cancelPendingPersistence])

	useLayoutEffect(() => {
		const syncDraft = () => {
			setDraftState(getStorageItem(LLAMA_AI_PROMPT_DRAFT_KEY, '') ?? '')
		}

		syncDraft()
		return subscribeToStorageKey(LLAMA_AI_PROMPT_DRAFT_KEY, syncDraft)
	}, [])

	useEffect(() => {
		window.addEventListener('pagehide', flushPendingPersistence)
		return () => {
			window.removeEventListener('pagehide', flushPendingPersistence)
			flushPendingPersistence()
		}
	}, [flushPendingPersistence])

	const setDraft = useCallback(
		(nextDraft: string) => {
			setDraftState(nextDraft)
			cancelPendingPersistence()

			if (nextDraft.length === 0) {
				pendingDraftRef.current = null
				removeStorageItem(LLAMA_AI_PROMPT_DRAFT_KEY)
				return
			}

			pendingDraftRef.current = nextDraft
			persistenceTimeoutRef.current = setTimeout(flushPendingPersistence, PROMPT_DRAFT_DEBOUNCE_MS)
		},
		[cancelPendingPersistence, flushPendingPersistence]
	)

	return [draft, setDraft] as const
}
