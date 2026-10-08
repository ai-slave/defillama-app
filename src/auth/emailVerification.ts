import { AUTH_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'

export class OtpRequestError extends Error {
	constructor(
		message: string,
		readonly retryAt = 0
	) {
		super(message)
	}
}

/** The server refused the code itself, so the sheet shows it under the code field rather than as a request failure. */
export class InvalidCodeError extends OtpRequestError {}

function requireAccount(accountId: string) {
	if (!pb.authStore.isValid || pb.authStore.record?.id !== accountId) {
		throw new OtpRequestError('Your account changed. Close this dialog and continue again.')
	}
}

export async function sendVerificationCode(accountId: string) {
	requireAccount(accountId)
	const response = await fetch(`${AUTH_SERVER}/sendOtp`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${pb.authStore.token}` }
	})
	requireAccount(accountId)
	if (response.status === 429) {
		// A proxy can return its own 429, including a non-JSON body without our timing metadata.
		const body: { details?: { retryAfterSeconds?: unknown } } | null = await response.json().catch(() => null)
		const seconds = body?.details?.retryAfterSeconds
		const now = Date.now()
		let retryAt = now + 60_000
		if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) {
			retryAt = now + seconds * 1000
		} else {
			const header = response.headers.get('Retry-After')
			if (header) {
				const headerSeconds = Number(header)
				const deadline =
					Number.isFinite(headerSeconds) && headerSeconds > 0 ? now + headerSeconds * 1000 : Date.parse(header)
				if (Number.isFinite(deadline) && deadline > now) retryAt = deadline
			}
		}
		throw new OtpRequestError('Wait before requesting another code.', retryAt)
	}
	if (!response.ok) throw new OtpRequestError('Could not send a code.')
	return Date.now() + 60_000
}

export async function verifyEmailCode(accountId: string, otp: string) {
	requireAccount(accountId)
	const response = await fetch(`${AUTH_SERVER}/verifyOtp`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pb.authStore.token}` },
		body: JSON.stringify({ otp })
	})
	requireAccount(accountId)
	if (response.status === 400) throw new InvalidCodeError('This code is wrong or has expired.')
	if (!response.ok) throw new OtpRequestError('Could not verify your email.')
	// The endpoint confirms this field. Keep the current token and other account data;
	// starting another auth refresh here competes with the auth-status query.
	pb.authStore.save(pb.authStore.token, { ...pb.authStore.record, verified: true })
}
