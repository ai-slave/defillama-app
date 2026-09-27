import { useCallback, useSyncExternalStore } from 'react'

const DEFAULT_TICK_MS = 30_000

let nowSecondsSnapshot = Math.floor(Date.now() / 1000)
/** Each subscriber's tick; the one clock runs at the fastest of them. */
const listeners = new Map<() => void, number>()
let intervalId: number | null = null
let intervalMs: number | null = null

const notifyListeners = () => {
	for (const listener of listeners.keys()) {
		listener()
	}
}

const syncNowSecondsSnapshot = () => {
	const nextNowSeconds = Math.floor(Date.now() / 1000)
	if (nextNowSeconds !== nowSecondsSnapshot) {
		nowSecondsSnapshot = nextNowSeconds
		notifyListeners()
	}
}

const restartClock = () => {
	if (typeof window === 'undefined') return
	let fastest: number | null = null
	for (const tickMs of listeners.values()) {
		if (fastest === null || tickMs < fastest) fastest = tickMs
	}
	if (fastest === intervalMs) return
	if (intervalId !== null) window.clearInterval(intervalId)
	intervalMs = fastest
	intervalId = fastest === null ? null : window.setInterval(syncNowSecondsSnapshot, fastest)
}

const subscribeToNowSeconds = (listener: () => void, tickMs: number) => {
	listeners.set(listener, tickMs)
	syncNowSecondsSnapshot()
	restartClock()

	return () => {
		listeners.delete(listener)
		restartClock()
	}
}

const getNowSecondsSnapshot = () => nowSecondsSnapshot

const normalizeInitialNowSeconds = (value?: number) => {
	if (typeof value !== 'number' || !Number.isFinite(value)) return nowSecondsSnapshot
	return Math.floor(value)
}

/**
 * The unix time in seconds, ticking every `tickMs`. `initialNowSeconds` is the clock the server rendered with, so
 * the hydrating client renders the same second and then moves to the browser clock without a mismatch.
 */
export function useNowSeconds(initialNowSeconds?: number, tickMs = DEFAULT_TICK_MS) {
	const subscribe = useCallback((listener: () => void) => subscribeToNowSeconds(listener, tickMs), [tickMs])
	const getServerSnapshot = useCallback(() => normalizeInitialNowSeconds(initialNowSeconds), [initialNowSeconds])

	return useSyncExternalStore(subscribe, getNowSecondsSnapshot, getServerSnapshot)
}
