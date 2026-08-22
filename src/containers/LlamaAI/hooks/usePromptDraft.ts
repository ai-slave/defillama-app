import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { getStorageItem, removeStorageItem, setStorageItem, subscribeToStorageKey } from '~/contexts/localStorageStore'

export const LLAMA_AI_PROMPT_DRAFT_KEY = 'llamaai-prompt-draft'
const PROMPT_DRAFT_DEBOUNCE_MS = 300
const MAX_STORED_DRAFTS = 20
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface DraftEntry {
	value: string
	dirty: boolean
}

const entries = new Map<string, DraftEntry>()
const listeners = new Map<string, Set<() => void>>()
const persistenceTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function promptDraftKey(scope: string): string {
	return `${LLAMA_AI_PROMPT_DRAFT_KEY}:${scope}`
}

function parseDraftValue(raw: string | null): string {
	if (!raw) return ''
	try {
		const parsed = JSON.parse(raw) as { value?: unknown }
		return typeof parsed.value === 'string' ? parsed.value : ''
	} catch {
		return raw
	}
}

function parseDraftUpdatedAt(raw: string | null): number {
	if (!raw) return 0
	try {
		const parsed = JSON.parse(raw) as { updatedAt?: unknown }
		return typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0
	} catch {
		return 0
	}
}

function notify(key: string) {
	for (const listener of listeners.get(key) ?? []) listener()
}

function releaseEntryIfUnused(key: string) {
	if (!listeners.has(key) && !persistenceTimers.has(key) && !entries.get(key)?.dirty) entries.delete(key)
}

function syncFromStorage(key: string) {
	if (entries.get(key)?.dirty) return
	const nextValue = parseDraftValue(getStorageItem(key, null))
	if (entries.get(key)?.value === nextValue) return
	entries.set(key, { value: nextValue, dirty: false })
	notify(key)
}

function pruneStoredDrafts(keepKey: string) {
	if (typeof window === 'undefined') return
	let keys: string[]
	try {
		keys = Object.keys(window.localStorage).filter((key) => key.startsWith(`${LLAMA_AI_PROMPT_DRAFT_KEY}:`))
	} catch {
		return
	}

	const now = Date.now()
	const surviving: Array<{ key: string; updatedAt: number }> = []
	for (const key of keys) {
		if (key === keepKey) continue
		const updatedAt = parseDraftUpdatedAt(getStorageItem(key, null))
		if (now - updatedAt > DRAFT_MAX_AGE_MS) {
			removeStorageItem(key)
			continue
		}
		surviving.push({ key, updatedAt })
	}

	surviving.sort((a, b) => b.updatedAt - a.updatedAt)
	for (const entry of surviving.slice(Math.max(0, MAX_STORED_DRAFTS - 1))) removeStorageItem(entry.key)
}

function flushDraftKey(key: string) {
	const timer = persistenceTimers.get(key)
	if (timer) clearTimeout(timer)
	persistenceTimers.delete(key)
	const entry = entries.get(key)
	if (!entry?.dirty) return
	if (entry.value) {
		setStorageItem(key, JSON.stringify({ value: entry.value, updatedAt: Date.now() }))
		pruneStoredDrafts(key)
	} else {
		removeStorageItem(key)
	}
	entries.set(key, { ...entry, dirty: false })
	releaseEntryIfUnused(key)
}

function getDraftSnapshot(scope: string) {
	const key = promptDraftKey(scope)
	const cached = entries.get(key)
	if (cached) return cached.value
	const value = parseDraftValue(getStorageItem(key, null) ?? getStorageItem(LLAMA_AI_PROMPT_DRAFT_KEY, null))
	entries.set(key, { value, dirty: false })
	return value
}

function subscribeToDraft(scope: string, listener: () => void) {
	const key = promptDraftKey(scope)
	if (!getStorageItem(key, null)) {
		const legacyDraft = getStorageItem(LLAMA_AI_PROMPT_DRAFT_KEY, null)
		if (legacyDraft) {
			setStorageItem(key, JSON.stringify({ value: parseDraftValue(legacyDraft), updatedAt: Date.now() }))
			removeStorageItem(LLAMA_AI_PROMPT_DRAFT_KEY)
		}
	}
	let keyListeners = listeners.get(key)
	if (!keyListeners) {
		keyListeners = new Set()
		listeners.set(key, keyListeners)
	}
	keyListeners.add(listener)
	syncFromStorage(key)

	const unsubscribeStorage = subscribeToStorageKey(key, () => syncFromStorage(key))
	return () => {
		unsubscribeStorage()
		keyListeners.delete(listener)
		if (keyListeners.size === 0) {
			listeners.delete(key)
			releaseEntryIfUnused(key)
		}
	}
}

function setPromptDraft(scope: string, value: string) {
	const key = promptDraftKey(scope)
	entries.set(key, { value, dirty: true })
	notify(key)
	const timer = persistenceTimers.get(key)
	if (timer) clearTimeout(timer)
	if (!value) {
		flushDraftKey(key)
		return
	}
	persistenceTimers.set(
		key,
		setTimeout(() => flushDraftKey(key), PROMPT_DRAFT_DEBOUNCE_MS)
	)
}

export function movePromptDraft(fromScope: string, toScope: string) {
	if (fromScope === toScope) return
	const value = getDraftSnapshot(fromScope)
	if (!value) return
	setPromptDraft(toScope, value)
	setPromptDraft(fromScope, '')
	flushDraftKey(promptDraftKey(toScope))
}

export function usePromptDraft(scope: string) {
	const subscribe = useCallback((listener: () => void) => subscribeToDraft(scope, listener), [scope])
	const getSnapshot = useCallback(() => getDraftSnapshot(scope), [scope])
	const draft = useSyncExternalStore(subscribe, getSnapshot, () => '')
	const setDraft = useCallback((value: string) => setPromptDraft(scope, value), [scope])

	useEffect(() => {
		const flush = () => flushDraftKey(promptDraftKey(scope))
		window.addEventListener('pagehide', flush)
		return () => {
			window.removeEventListener('pagehide', flush)
			flush()
		}
	}, [scope])

	return [draft, setDraft] as const
}
