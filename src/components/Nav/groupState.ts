import Router from 'next/router'
import { useSyncExternalStore } from 'react'
import { navPath } from './path'

// Page layouts remount during client navigation. Keep the accordion in memory so
// desktop/mobile share manual choices. A new page defaults to its active group;
// a full refresh forgets manual choices.
const openGroups = new Map<string, { pathname: string | null; route: string | null }>()
const listeners = new Set<() => void>()
let routeListenerAttached = false

function subscribe(listener: () => void) {
	if (!routeListenerAttached) {
		Router.events.on('routeChangeComplete', leavePage)
		routeListenerAttached = true
	}
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function leavePage(url?: string) {
	const pathname = url ? navPath(url) : null
	for (const [scope, choice] of openGroups) {
		if (choice.pathname && choice.pathname !== pathname) {
			// Forget the page override so Back reveals its active group again.
			// Retain the group as the fallback for destinations outside the accordion.
			openGroups.set(scope, { ...choice, pathname: null })
		}
	}
	notify()
}

function notify() {
	for (const listener of listeners) listener()
}

/** Reset the document's navigation state when testing a fresh browser runtime. */
export function resetNavGroupState() {
	openGroups.clear()
	notify()
}

export function useNavGroupState(scope: string, pathname: string, activeGroup: string | null) {
	const choice = useSyncExternalStore(
		subscribe,
		() => openGroups.get(scope) ?? null,
		() => null
	)
	const openGroup = choice?.pathname === pathname ? choice.route : (activeGroup ?? choice?.route ?? null)
	const toggleGroup = (route: string) => {
		openGroups.set(scope, { pathname, route: openGroup === route ? null : route })
		notify()
	}
	return { openGroup, toggleGroup }
}
