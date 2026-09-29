/* A browser-local note that a team checkout was paid and is waiting for the webhook. The account page writes it
   when Stripe's redirect lands; while it stands and the team still shows no subscription of that type, Purchase
   Seats holds instead of opening a second checkout that could be paid too. It guards this browser only. */
export interface PendingTeamCheckout {
	seats: number
	startedAt: number
}

// Where Stripe returns a paid team checkout. The account page reads `type` and `seats` back for its toast and the
// purchase hold.
export const teamCheckoutReturnPath = (type: string, seats: number) =>
	`/account?tab=team&team-checkout=success&type=${type}&seats=${seats}`

// The webhook normally lands within seconds; after this the hold lifts rather than blocking a purchase forever.
export const TEAM_CHECKOUT_HOLD_MS = 30 * 60 * 1000

const storageKey = (userId: string, type: string) => `pending-team-checkout:${userId}:${type}`

// Storage can be unavailable (private windows, blocked site data); Purchase Seats then does not hold.
export function readPendingTeamCheckout(userId: string, type: string): PendingTeamCheckout | null {
	try {
		const raw = localStorage.getItem(storageKey(userId, type))
		return raw ? (JSON.parse(raw) as PendingTeamCheckout) : null
	} catch {
		return null
	}
}

export function savePendingTeamCheckout(userId: string, type: string, checkout: PendingTeamCheckout) {
	try {
		localStorage.setItem(storageKey(userId, type), JSON.stringify(checkout))
	} catch {
		// Unavailable storage leaves Purchase Seats without the hold, as for a read.
	}
}

export function clearPendingTeamCheckout(userId: string, type: string) {
	try {
		localStorage.removeItem(storageKey(userId, type))
	} catch {
		// Unavailable storage leaves Purchase Seats without the hold, as for a read.
	}
}
