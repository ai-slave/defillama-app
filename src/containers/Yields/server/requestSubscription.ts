import { validateSubscription } from '~/utils/apiAuth'

// Awaited before any page or stream responds. The fetch helper's own timer covers only the headers
// (60s by default), so a stalled auth server or response body must instead fail fast into the
// neutral (null) state here.
const SUBSCRIPTION_TIMEOUT_MS = 5000

/**
 * The session's entitlement: true for an active subscriber, false for no session or no
 * subscription, and null when the validators could not be reached. Null is not a verdict, so a
 * page renders its neutral state and lets the client resolve rather than showing a subscriber the
 * locked variant.
 */
export async function resolveSubscription(token: string | null): Promise<boolean | null> {
	if (!token) return false
	let timer: ReturnType<typeof setTimeout> | undefined
	const deadline = new Promise<null>((resolve) => {
		timer = setTimeout(() => resolve(null), SUBSCRIPTION_TIMEOUT_MS)
	})
	try {
		const result = await Promise.race([validateSubscription(`Bearer ${token}`), deadline])
		if (result === null) return null
		return result.valid === false && result.status === 503 ? null : result.valid
	} catch {
		return null
	} finally {
		clearTimeout(timer)
	}
}
