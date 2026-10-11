import { SERVER_URL } from '~/constants'
import { notifyKeyChange } from '~/contexts/localStorageStore'

export type InviteClaim =
	| { status: 'assigned'; code: string; refreshAt: string }
	| { status: 'cooldown'; retryAt: string }
	| { status: 'unavailable' }

type InviteError = { status: 'invalid_request' | 'verification_failed' | 'disabled' | 'error' | 'not_found' }

export async function fetchInviteAvailability({ protocol, signal }: { protocol: string; signal: AbortSignal }) {
	const response = await fetch(`${SERVER_URL}/invites/${encodeURIComponent(protocol)}`, { signal, cache: 'no-store' })
	if (response.status === 404) return { available: false }
	if (!response.ok) throw new Error('Could not check invite availability.')
	return response.json() as Promise<{ available: boolean }>
}

export async function revealInvite({
	protocol,
	turnstileToken,
	refresh
}: {
	protocol: string
	turnstileToken: string
	refresh: boolean
}): Promise<InviteClaim> {
	// Save the identity before sending: a lost response must not allocate another code on retry.
	let visitorId: string
	try {
		const key = `protocol-invite:${protocol}`
		visitorId = localStorage.getItem(key) || crypto.randomUUID()
		localStorage.setItem(key, visitorId)
		notifyKeyChange(key)
	} catch {
		throw new Error('Enable browser storage to keep your invite code between visits.')
	}
	const response = await fetch(`${SERVER_URL}/invites/${encodeURIComponent(protocol)}/claim`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		cache: 'no-store',
		signal: AbortSignal.timeout(20_000),
		body: JSON.stringify({ visitorId, turnstileToken, refresh })
	}).catch(() => {
		throw new Error('Could not retrieve an invite code. Check your connection and try again.')
	})
	if (response.status >= 500) throw new Error('Invite codes are temporarily unavailable. Try again later.')
	const result: InviteClaim | InviteError = await response.json()
	switch (result.status) {
		case 'assigned':
		case 'unavailable':
			if (!response.ok) throw new Error("Couldn't get an invite code. Try again.")
			return result
		case 'cooldown':
			if (response.status !== 429) throw new Error("Couldn't get an invite code. Try again.")
			return result
		case 'verification_failed':
			throw new Error('Verification expired or failed. Verify again.')
		case 'invalid_request':
			throw new Error("Couldn't get your invite code. Reload the page and try again.")
		case 'disabled':
		case 'not_found':
			throw new Error('Invite codes are currently unavailable.')
		case 'error':
			throw new Error("Couldn't get an invite code. Try again.")
	}
}
