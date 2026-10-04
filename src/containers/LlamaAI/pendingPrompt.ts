import type { AgenticAnswerMode } from '~/containers/LlamaAI/types'
import { notifyKeyChange, subscribeToStorageKey } from '~/contexts/localStorageStore'

// A prompt or page context handed from another page to /ai/chat, which consumes it once on arrival.
const PENDING_PROMPT_KEY = 'llamaai-pending-prompt'
const PENDING_PAGE_CONTEXT_KEY = 'llamaai-pending-page-context'

export function setPendingPrompt(prompt: string) {
	if (typeof window === 'undefined') return
	localStorage.setItem(PENDING_PROMPT_KEY, prompt)
	notifyKeyChange(PENDING_PROMPT_KEY)
}

/** Notifies on both handover and consumption, so a reader can defer to a waiting prompt reactively. */
export function subscribeToPendingPrompt(callback: () => void) {
	return subscribeToStorageKey(PENDING_PROMPT_KEY, callback)
}

/** Whether a prompt is waiting, without taking it. Lets a reader defer to it before it is consumed. */
export function hasPendingPrompt(): boolean {
	if (typeof window === 'undefined') return false
	return localStorage.getItem(PENDING_PROMPT_KEY) !== null
}

export function hasNoPendingPrompt(): boolean {
	return false
}

export function consumePendingPrompt(): string | null {
	if (typeof window === 'undefined') return null
	const prompt = localStorage.getItem(PENDING_PROMPT_KEY)
	if (prompt) {
		localStorage.removeItem(PENDING_PROMPT_KEY)
		notifyKeyChange(PENDING_PROMPT_KEY)
	}
	return prompt
}

const PENDING_SUGGESTED_KEY = 'llamaai-pending-suggested'
const PENDING_ENTRY_SOURCE_KEY = 'llamaai-pending-entry-source'
const PENDING_MODE_KEY = 'llamaai-pending-mode'

export function setPendingEntrySource(source: string) {
	if (typeof window !== 'undefined') {
		localStorage.setItem(PENDING_ENTRY_SOURCE_KEY, source)
	}
}

export function consumePendingEntrySource(): string | undefined {
	if (typeof window === 'undefined') return undefined
	const val = localStorage.getItem(PENDING_ENTRY_SOURCE_KEY)
	if (val) localStorage.removeItem(PENDING_ENTRY_SOURCE_KEY)
	return val || undefined
}

export function setPendingSuggestedFlag() {
	if (typeof window !== 'undefined') {
		localStorage.setItem(PENDING_SUGGESTED_KEY, 'true')
	}
}

export function consumePendingSuggestedFlag(): boolean {
	if (typeof window === 'undefined') return false
	const val = localStorage.getItem(PENDING_SUGGESTED_KEY)
	if (val) localStorage.removeItem(PENDING_SUGGESTED_KEY)
	return val === 'true'
}

export function setPendingPageContext(
	context: { entitySlug?: string; entityType?: 'protocol' | 'chain' | 'page'; route: string } | null
) {
	if (typeof window === 'undefined') return
	if (context) {
		localStorage.setItem(PENDING_PAGE_CONTEXT_KEY, JSON.stringify(context))
	} else {
		localStorage.removeItem(PENDING_PAGE_CONTEXT_KEY)
	}
}

export function consumePendingPageContext(): {
	entitySlug?: string
	entityType?: 'protocol' | 'chain' | 'page'
	route: string
} | null {
	if (typeof window === 'undefined') return null
	const raw = localStorage.getItem(PENDING_PAGE_CONTEXT_KEY)
	if (!raw) return null
	localStorage.removeItem(PENDING_PAGE_CONTEXT_KEY)
	try {
		return JSON.parse(raw)
	} catch {
		return null
	}
}

/** The answer mode picked before sign-in, so a Research pick is not sent as a quick question. */
export function setPendingMode(mode: AgenticAnswerMode) {
	if (typeof window === 'undefined') return
	localStorage.setItem(PENDING_MODE_KEY, mode)
}

export function consumePendingMode(): AgenticAnswerMode | undefined {
	if (typeof window === 'undefined') return undefined
	const value = localStorage.getItem(PENDING_MODE_KEY)
	localStorage.removeItem(PENDING_MODE_KEY)
	// Storage holds whatever an older build wrote, so only the modes the chat knows are read back.
	return value === 'quick' || value === 'fact_checked' || value === 'research' ? value : undefined
}

export function clearPendingPrompt() {
	if (typeof window === 'undefined') return
	for (const key of [
		PENDING_PROMPT_KEY,
		PENDING_SUGGESTED_KEY,
		PENDING_ENTRY_SOURCE_KEY,
		PENDING_PAGE_CONTEXT_KEY,
		PENDING_MODE_KEY
	]) {
		localStorage.removeItem(key)
	}
	notifyKeyChange(PENDING_PROMPT_KEY)
}
