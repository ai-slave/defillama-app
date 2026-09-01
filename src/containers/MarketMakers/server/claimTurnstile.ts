const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TURNSTILE_TIMEOUT_MS = 5_000
const TURNSTILE_ACTION = 'claim'
const MAX_TOKEN_LENGTH = 2_048

const UNAVAILABLE_ERROR_CODES = new Set([
	'missing-input-secret',
	'invalid-input-secret',
	'invalid-widget-id',
	'invalid-parsed-secret',
	'internal-error'
])

type TurnstileResult = { ok: true } | { ok: false; reason: 'invalid' | 'unavailable' }

type SiteverifyResponse = {
	success?: unknown
	action?: unknown
	'error-codes'?: unknown
}

export function isClaimTurnstileEnabled(): boolean {
	return Boolean(process.env.CLAIMS_TURNSTILE_SECRET_KEY?.trim())
}

export async function verifyClaimTurnstile(token: unknown, remoteIp: string): Promise<TurnstileResult> {
	if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
		return { ok: false, reason: 'invalid' }
	}

	const secret = process.env.CLAIMS_TURNSTILE_SECRET_KEY?.trim()
	if (!secret) return { ok: false, reason: 'unavailable' }

	const body = new FormData()
	body.set('secret', secret)
	body.set('response', token)
	if (remoteIp !== 'unknown') body.set('remoteip', remoteIp)

	try {
		const response = await fetch(SITEVERIFY_URL, {
			method: 'POST',
			body,
			signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS)
		})
		if (!response.ok) return { ok: false, reason: 'unavailable' }

		const result = (await response.json()) as SiteverifyResponse
		if (result.success === true) {
			return result.action === TURNSTILE_ACTION ? { ok: true } : { ok: false, reason: 'invalid' }
		}

		const errorCodes = Array.isArray(result['error-codes'])
			? result['error-codes'].filter((code): code is string => typeof code === 'string')
			: []
		return errorCodes.some((code) => UNAVAILABLE_ERROR_CODES.has(code))
			? { ok: false, reason: 'unavailable' }
			: { ok: false, reason: 'invalid' }
	} catch {
		return { ok: false, reason: 'unavailable' }
	}
}
