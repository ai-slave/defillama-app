import { notifyKeyChange, subscribeToStorageKey } from '~/contexts/localStorageStore'

// A prompt, page context or project handed from another page to /ai/chat, which consumes it once on arrival.
const PENDING_PROMPT_KEY = 'llamaai-pending-prompt'
const PENDING_PAGE_CONTEXT_KEY = 'llamaai-pending-page-context'
const PENDING_PROJECT_ID_KEY = 'llamaai-pending-project-id'

export function setPendingProjectId(projectId: string | null) {
	if (typeof window === 'undefined') return
	if (projectId) {
		localStorage.setItem(PENDING_PROJECT_ID_KEY, projectId)
	} else {
		localStorage.removeItem(PENDING_PROJECT_ID_KEY)
	}
}

export function consumePendingProjectId(): string | null {
	if (typeof window === 'undefined') return null
	const id = localStorage.getItem(PENDING_PROJECT_ID_KEY)
	if (id) localStorage.removeItem(PENDING_PROJECT_ID_KEY)
	return id
}

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
