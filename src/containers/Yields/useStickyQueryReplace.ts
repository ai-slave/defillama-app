import { useRouter } from 'next/router'
import * as React from 'react'
import { useIsClient } from '~/hooks/useIsClient'
import { applyStickyPrefs, type StickyQueryPref } from './stickyQueryPrefs'

type QueryRecord = Record<string, string | Array<string> | undefined>

function navigationKey(href: string) {
	const url = new URL(href, window.location.href)
	url.searchParams.sort()
	return url.href
}

function restoreNavigationKey(pathname: string, target: QueryRecord) {
	const url = new URL(window.location.href)
	url.search = ''
	// Dynamic route parameters are already in the path.
	const routeParams = new Set(Array.from(pathname.matchAll(/\[(?:\.\.\.)?(\w+)\]/g), (match) => match[1]))
	for (const [key, value] of Object.entries(target)) {
		if (routeParams.has(key) || value === undefined) continue
		for (const entry of Array.isArray(value) ? value : [value]) url.searchParams.append(key, entry)
	}
	return navigationKey(url.href)
}

// Read after hydration, without subscribing to other tabs' preference changes.
export function useStickyPrefsOverlay(query: QueryRecord | null, prefs: ReadonlyArray<StickyQueryPref>) {
	const isClient = useIsClient()
	return React.useMemo(() => (isClient && query ? applyStickyPrefs(query, prefs) : null), [isClient, query, prefs])
}

// Retry canceled hydration once, then release fetching even if restoration fails.
export function useStickyQueryReplace(target: QueryRecord | null): boolean {
	const router = useRouter()
	const isClient = useIsClient()
	const [failure, setFailure] = React.useState<{ key: string; count: number } | null>(null)
	const attemptedRef = React.useRef<{
		id: string
		key: string
		destination: string
		started: boolean
		superseded: boolean
	} | null>(null)
	const key = target == null ? null : JSON.stringify([router.pathname, router.query, target])
	// Reset the retry budget when the destination changes.
	if (failure && failure.key !== key) setFailure(null)
	const failures = failure?.key === key ? failure.count : 0
	const exhausted = failures >= 2

	React.useEffect(() => {
		const onNavigationStart = (url: string) => {
			const attempt = attemptedRef.current
			if (!attempt || attempt.superseded) return
			if (!attempt.started && navigationKey(url) === attempt.destination) attempt.started = true
			else {
				attempt.superseded = true
				// Cancel pending retries and release fetching if the new navigation also fails.
				setFailure({ key: attempt.key, count: 2 })
			}
		}
		router.events.on('routeChangeStart', onNavigationStart)
		return () => {
			router.events.off('routeChangeStart', onNavigationStart)
		}
	}, [router.events])

	React.useEffect(() => {
		if (!router.isReady) return
		if (key == null || target == null) {
			attemptedRef.current = null
			return
		}
		if (exhausted) return
		const id = JSON.stringify([key, failures])
		if (attemptedRef.current?.id === id) return
		const attempt = {
			id,
			key,
			destination: restoreNavigationKey(router.pathname, target),
			started: false,
			superseded: false
		}
		attemptedRef.current = attempt
		const onFailure = () => {
			if (attemptedRef.current !== attempt || attempt.superseded) return
			setFailure({ key, count: failures + 1 })
			if (failures === 1) console.warn('Unable to restore yields view preferences; using the current URL.')
		}
		void router
			.replace({ pathname: router.pathname, query: target, hash: window.location.hash }, undefined, {
				shallow: true,
				scroll: false
			})
			.then((completed) => {
				if (!completed) onFailure()
			}, onFailure)
	}, [router, target, key, failures, exhausted])

	// Keep placeholders until hydration and restoration settle.
	return isClient && router.isReady && (target == null || exhausted)
}
