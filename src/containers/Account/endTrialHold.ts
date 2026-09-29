import { useSyncExternalStore } from 'react'
import { useAuthContext } from '~/auth'
import { useNowSeconds } from '~/hooks/useNowSeconds'

// Ending a trial charges the card at once, and the backend refuses a repeat only once the Stripe webhook has
// cleared the trial. Until then every "end trial" action for that account stays disabled. The hold is kept per
// account in the browser, so it outlives the dialog that sent the request, the card that opened it and a reload.
// Trial actions render only while the account reads as a trial, and the hold lifts after a while rather than
// blocking the upgrade for good if the webhook never lands.
const HOLD_MS = 30 * 60 * 1000
const storageKey = (accountId: string) => `end-trial-hold:${accountId}`
const listeners = new Set<() => void>()

export const END_TRIAL_APPLYING_REASON = 'Your upgrade is being applied. This can take a minute.'

// Storage can be unavailable (private windows, blocked site data); the hold then lasts only while this tab renders.
function readHold(accountId: string): number | null {
	try {
		const raw = localStorage.getItem(storageKey(accountId))
		return raw ? Number(raw) : null
	} catch {
		return null
	}
}

export function holdEndTrial(accountId: string) {
	try {
		localStorage.setItem(storageKey(accountId), String(Date.now()))
	} catch {
		// Unavailable storage leaves the hold to this render, as for a read.
	}
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
	listeners.add(listener)
	// Another tab that ends the trial holds this one too.
	window.addEventListener('storage', listener)
	return () => {
		listeners.delete(listener)
		window.removeEventListener('storage', listener)
	}
}

export function useEndTrialApplying(): boolean {
	const accountId = useAuthContext().user?.id ?? null
	// The server and the hydrating client both render without the hold; the stored one applies right after.
	const heldAt = useSyncExternalStore(
		subscribe,
		() => (accountId ? readHold(accountId) : null),
		() => null
	)
	const nowSeconds = useNowSeconds()
	return heldAt !== null && nowSeconds * 1000 - heldAt < HOLD_MS
}
