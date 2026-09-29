import type { PaymentIntent } from '@stripe/stripe-js'

export interface UpgradePricing {
	amount: number
	currency: string
	prorationCredit: number
	newSubscriptionPrice: number
}

/* A browser-local record of the upgrade PaymentIntent this browser has open, written when the backend creates the
   intent. While it could still take money, no tab of this browser offers a new upgrade payment: a payable intent is
   resumed, so it succeeds at most once, and one too old or for another plan to resume holds new upgrades until
   support cancels it, since the frontend cannot. The record is dropped only on facts about that intent (see
   `isFinished`), never on a plan, an interval or a return URL.

   It narrows duplicate payments; it does not prevent them. It knows nothing of other devices, of storage that is
   blocked or cleared, of an intent whose create response was lost, or of a browser without Web Locks racing its
   own tabs. Only the backend's purchase identity closes those. */
export interface PendingUpgrade {
	plan: 'api' | 'llamafeed'
	interval: 'month' | 'year'
	clientSecret: string
	pricing: UpgradePricing | null
	createdAt: number
}

// Money may be moving: the payment is settling, authorized, or taken and waiting for the webhook.
export type UnderWayStatus = 'processing' | 'requires_capture' | 'succeeded'

export const isUnderWay = (status: PaymentIntent.Status): status is UnderWayStatus =>
	status === 'processing' || status === 'requires_capture' || status === 'succeeded'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

/* A finished intent can never take money again: Stripe canceled it, or it succeeded and its target plan shows.
   The plan read is an entitlement check, not proof that this intent's webhook ran, so forgetting a succeeded intent
   only stops holding new upgrades while that webhook might still be pending. */
export const isFinished = (status: PaymentIntent.Status, targetApplied: boolean) =>
	status === 'canceled' || (status === 'succeeded' && targetApplied)

type EarlierUpgradeDecision =
	| { kind: 'forget' }
	| { kind: 'resume'; awaitingVerification: boolean }
	| { kind: 'underWay'; status: UnderWayStatus; stale: boolean }
	| { kind: 'hold'; stale: boolean }

/* What an upgrade opening does about the intent this browser already has open. `status` is Stripe's for that intent,
   and `targetApplied` whether its target plan shows, read only when it succeeded. An intent under way stays guarded
   whatever the plan reads, since it can still succeed. A payable one is resumed only while its amount is fresh and
   the opening is for its plan; otherwise a second intent could be paid too. */
export function decideEarlierUpgrade(
	earlier: PendingUpgrade,
	status: PaymentIntent.Status,
	targetApplied: boolean,
	opening: { plan: PendingUpgrade['plan']; interval: PendingUpgrade['interval'] },
	now: number
): EarlierUpgradeDecision {
	if (isFinished(status, targetApplied)) return { kind: 'forget' }
	const age = now - earlier.createdAt
	if (isUnderWay(status)) return { kind: 'underWay', status, stale: age > WEEK_MS }
	const stale = age >= DAY_MS
	if (stale || earlier.plan !== opening.plan || earlier.interval !== opening.interval) return { kind: 'hold', stale }
	return { kind: 'resume', awaitingVerification: status === 'requires_action' }
}

const storageKey = (userId: string) => `pending-upgrade:${userId}`

/* Tabs take turns with the record: each check, create and delete runs inside this lock, so a tab never acts on a
   record another tab is replacing. Browsers without Web Locks run unordered, and the checked delete below still
   keeps a newer record. */
export function withUpgradeLock<T>(userId: string, run: () => Promise<T>): Promise<T> {
	return navigator.locks ? navigator.locks.request(storageKey(userId), run) : run()
}

// Storage can be unavailable (private windows, blocked site data); the guard then covers only the open dialog.
export function readPendingUpgrade(userId: string): PendingUpgrade | null {
	try {
		const raw = localStorage.getItem(storageKey(userId))
		return raw ? (JSON.parse(raw) as PendingUpgrade) : null
	} catch {
		return null
	}
}

export function savePendingUpgrade(userId: string, upgrade: PendingUpgrade) {
	try {
		localStorage.setItem(storageKey(userId), JSON.stringify(upgrade))
	} catch {
		// Unavailable storage leaves the guard to the open dialog, as for a read.
	}
}

// Deletes the record only while it still names the intent the caller checked, so a finished check of one intent
// never removes a newer one.
export function forgetPendingUpgrade(userId: string, clientSecret: string) {
	if (readPendingUpgrade(userId)?.clientSecret !== clientSecret) return
	try {
		localStorage.removeItem(storageKey(userId))
	} catch {
		// Unavailable storage leaves the guard to the open dialog, as for a read.
	}
}
