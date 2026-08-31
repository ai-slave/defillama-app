export const UMAMI_READY_EVENT = 'umami-ready'

export function trackUmamiEvent(eventName: string, data?: Record<string, unknown>): void {
	try {
		if (typeof window === 'undefined') return
		window.umami?.track(eventName, data)
	} catch {}
}
