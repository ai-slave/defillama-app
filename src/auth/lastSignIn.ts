import { useSyncExternalStore } from 'react'

type LastSignIn = { method: 'email' | 'google' | 'github' } | { method: 'wallet'; connectorId: string }
const STORAGE_KEY = 'last-sign-in'
const CHANGE_EVENT = 'last-sign-in-changed'

function getSnapshot() {
	try {
		return window.localStorage.getItem(STORAGE_KEY)
	} catch {
		return null
	}
}

function getServerSnapshot() {
	return null
}

function subscribe(notify: () => void) {
	window.addEventListener('storage', notify)
	window.addEventListener(CHANGE_EVENT, notify)
	return () => {
		window.removeEventListener('storage', notify)
		window.removeEventListener(CHANGE_EVENT, notify)
	}
}

function parseLastSignIn(stored: string | null): LastSignIn | null {
	if (!stored) return null
	// Browser storage can contain old or edited values; a bad hint must not affect sign-in.
	try {
		const value = JSON.parse(stored) as Partial<LastSignIn> | null
		if (value?.method === 'email' || value?.method === 'google' || value?.method === 'github')
			return { method: value.method }
		if (value?.method === 'wallet' && typeof value.connectorId === 'string' && value.connectorId)
			return { method: 'wallet', connectorId: value.connectorId }
	} catch {
		// An unreadable hint is equivalent to no remembered method.
	}
	return null
}

export function useLastSignIn() {
	return parseLastSignIn(useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot))
}

export function rememberSignIn(value: LastSignIn) {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
		window.dispatchEvent(new Event(CHANGE_EVENT))
	} catch {
		// Remembering a method is optional, including when browser storage is disabled.
	}
}
