import { useSyncExternalStore } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion() {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
	return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

function subscribe(onStoreChange: () => void) {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
	const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY)
	const legacyMediaQueryList = mediaQueryList as MediaQueryList & {
		addListener?: (listener: (event: MediaQueryListEvent) => void) => void
		removeListener?: (listener: (event: MediaQueryListEvent) => void) => void
	}
	if ('addEventListener' in mediaQueryList) {
		mediaQueryList.addEventListener('change', onStoreChange)
		return () => {
			mediaQueryList.removeEventListener('change', onStoreChange)
		}
	}
	legacyMediaQueryList.addListener?.(onStoreChange)
	return () => {
		legacyMediaQueryList.removeListener?.(onStoreChange)
	}
}

export function usePrefersReducedMotion() {
	return useSyncExternalStore(subscribe, prefersReducedMotion, () => false)
}
