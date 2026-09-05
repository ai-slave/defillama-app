import { getABGroupFromCookie, getABTag } from '~/utils/abTesting'

export const UMAMI_READY_EVENT = 'umami-ready'

export function addABTag(payload: Record<string, unknown>, cookieString: string): Record<string, unknown> {
	const group = getABGroupFromCookie(cookieString)
	return group ? { ...payload, tag: getABTag(group) } : payload
}

export function trackUmamiEvent(eventName: string, data?: Record<string, unknown>): void {
	try {
		if (typeof window === 'undefined') return
		window.umami?.track(eventName, data)
	} catch {}
}
