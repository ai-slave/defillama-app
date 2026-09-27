import { useCallback, useState, useSyncExternalStore } from 'react'
import { usePageClockSec } from './usePageClock'

const DEFAULT_TICK_MS = 30_000

const readNowSeconds = () => Math.floor(Date.now() / 1000)

let nowSecondsSnapshot = readNowSeconds()
/** Each subscriber's tick; the one clock runs at the fastest of them. */
const listeners = new Map<() => void, number>()
let intervalId: number | null = null
let intervalMs: number | null = null
let warnedMissingClock = false

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

const getNowSecondsSnapshot = () => {
	// Between subscriptions no interval keeps the second fresh, so a first render would read the second the
	// module loaded at and re-render once the subscription synced. Refresh on read instead.
	if (intervalId === null) nowSecondsSnapshot = Math.floor(Date.now() / 1000)
	return nowSecondsSnapshot
}

function firstRenderSeconds(initialNowSeconds: number | undefined, pageClockSec: number | null): number {
	if (initialNowSeconds !== undefined) return Math.floor(initialNowSeconds)
	if (pageClockSec !== null) return pageClockSec
	return missingPageClock()
}

function missingPageClock(): number {
	const message =
		'useNowSeconds has no clock for the first render: this page has no data function, so pass a seed or render the ' +
		'time after mount. Without one the server HTML and the hydrating client disagree.'
	if (process.env.NODE_ENV !== 'production') throw new Error(message)
	if (!warnedMissingClock) {
		warnedMissingClock = true
		console.error(message)
	}
	// Nothing refreshes the snapshot on the server, so it holds the second the process loaded this module.
	return readNowSeconds()
}

/**
 * The unix time in seconds, ticking every `tickMs`. The first render, on the server
 * and on the hydrating client, uses `initialNowSeconds` when given, else the page clock its props carry; the value
 * then moves to the browser clock. A page without either is an error: the render would not hydrate.
 */
export function useNowSeconds(initialNowSeconds?: number, tickMs = DEFAULT_TICK_MS) {
	const pageClockSec = usePageClockSec()
	const subscribe = useCallback((listener: () => void) => subscribeToNowSeconds(listener, tickMs), [tickMs])
	const getServerSnapshot = useCallback(
		() => firstRenderSeconds(initialNowSeconds, pageClockSec),
		[initialNowSeconds, pageClockSec]
	)

	return useSyncExternalStore(subscribe, getNowSecondsSnapshot, getServerSnapshot)
}

const subscribeToNothing = () => () => {}

/**
 * The unix time in seconds, read once: the same first render as `useNowSeconds`, then the browser second this
 * component mounted at, which never changes. It stays off the shared clock, so no other subscriber's tick and no
 * later render moves it.
 */
export function useNowSecondsOnce(initialNowSeconds?: number) {
	const pageClockSec = usePageClockSec()
	const [mountSeconds] = useState(readNowSeconds)
	const getSnapshot = useCallback(() => mountSeconds, [mountSeconds])
	const getServerSnapshot = useCallback(
		() => firstRenderSeconds(initialNowSeconds, pageClockSec),
		[initialNowSeconds, pageClockSec]
	)

	return useSyncExternalStore(subscribeToNothing, getSnapshot, getServerSnapshot)
}
