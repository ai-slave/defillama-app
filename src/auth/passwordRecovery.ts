import { AUTH_SERVER } from '~/constants'

export async function requestPasswordReset(email: string, turnstileToken: string, signal?: AbortSignal) {
	let response: Response
	try {
		response = await fetch(`${AUTH_SERVER}/auth/request-password-reset`, {
			method: 'POST',
			signal,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, turnstile_token: turnstileToken })
		})
	} catch (error) {
		throw new Error('Could not request a reset link. Check your connection.', { cause: error })
	}
	if (response.ok) return
	const body: { error?: string } = await response.json().catch(() => ({}))
	if (response.status === 429) throw new Error('Too many reset requests. Wait before trying again.')
	if (response.status === 400 && /captcha/i.test(body.error ?? ''))
		throw new Error('Complete the CAPTCHA verification again.')
	throw new Error('Could not request a reset link. Try again.')
}
