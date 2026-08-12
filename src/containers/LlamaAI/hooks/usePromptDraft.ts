import { useCallback, useLayoutEffect, useState } from 'react'
import { getStorageItem, removeStorageItem, setStorageItem, subscribeToStorageKey } from '~/contexts/localStorageStore'

export const LLAMA_AI_PROMPT_DRAFT_KEY = 'llamaai-prompt-draft'

export function usePromptDraft() {
	const [draft, setDraftState] = useState('')

	useLayoutEffect(() => {
		const syncDraft = () => {
			setDraftState(getStorageItem(LLAMA_AI_PROMPT_DRAFT_KEY, '') ?? '')
		}

		syncDraft()
		return subscribeToStorageKey(LLAMA_AI_PROMPT_DRAFT_KEY, syncDraft)
	}, [])

	const setDraft = useCallback((nextDraft: string) => {
		setDraftState(nextDraft)
		if (nextDraft.length > 0) {
			setStorageItem(LLAMA_AI_PROMPT_DRAFT_KEY, nextDraft)
		} else {
			removeStorageItem(LLAMA_AI_PROMPT_DRAFT_KEY)
		}
	}, [])

	return [draft, setDraft] as const
}
