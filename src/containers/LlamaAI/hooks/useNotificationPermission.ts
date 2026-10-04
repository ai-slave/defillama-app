import { useSyncExternalStore } from 'react'

export type NotificationPermissionState = NotificationPermission | 'unsupported'

function readPermission(): NotificationPermissionState {
	if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported'
	return Notification.permission
}

// The server cannot know the permission, and rendering a decision from a guess would not survive
// hydration. Reporting it unsupported keeps notification UI hidden until the client reads it.
function readServerPermission(): NotificationPermissionState {
	return 'unsupported'
}

/** The browser reports permission but never announces a change, so requesting it notifies here. */
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
	listeners.add(onChange)
	return () => {
		listeners.delete(onChange)
	}
}

/**
 * Asks the browser for permission, then tells every reader. Some browsers throttle repeated requests and resolve to
 * 'default' without showing a prompt (Chrome quiet UI, users who dismissed the system prompt before), so any result
 * but 'granted' runs `onRefused`, letting the caller stop asking a user the browser will not prompt again.
 */
export function requestNotificationPermission(onRefused: () => void) {
	return Notification.requestPermission().then(
		(next) => {
			for (const listener of listeners) listener()
			if (next !== 'granted') onRefused()
		},
		() => onRefused()
	)
}

/**
 * The browser's notification permission, read during render.
 *
 * This is the browser's own permission, never a stored preference: it says whether the site may
 * post notifications, not whether the user asked for them. Anything the user can switch off lives
 * in settings and must not be inferred from this value -- and in particular, `'unsupported'` means
 * "not readable here", never "the user turned it off".
 */
export function useNotificationPermission(): NotificationPermissionState {
	return useSyncExternalStore(subscribe, readPermission, readServerPermission)
}
