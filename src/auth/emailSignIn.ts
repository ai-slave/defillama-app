import { acceptAuthSession, type AuthRequest } from '~/auth/authRequest'
import { rememberSignIn } from '~/auth/lastSignIn'
import { AUTH_SERVER } from '~/constants'
import type { AuthModel } from '~/utils/pocketbase'

export async function signInWithPassword({
	email,
	password,
	turnstileToken,
	signal,
	canAccept,
	onAuthenticated
}: {
	email: string
	password: string
	turnstileToken: string
} & AuthRequest) {
	return acceptAuthSession(
		{ signal, canAccept, onAuthenticated },
		async () => {
			let response: Response
			try {
				// The features server fronts PocketBase: captcha, per-account throttling, then auth-with-password.
				response = await fetch(`${AUTH_SERVER}/auth/login`, {
					method: 'POST',
					signal,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password, turnstile_token: turnstileToken })
				})
			} catch (error) {
				throw new Error('Could not reach the sign-in service. Check your connection.', { cause: error })
			}
			if (!response.ok) {
				const body: { error?: string } = await response.json().catch(() => ({}))
				if (response.status === 429) throw new Error('Too many sign-in attempts. Wait before trying again.')
				if (response.status === 400 || response.status === 401) {
					if (/captcha/i.test(body.error ?? '')) throw new Error('Complete the CAPTCHA verification again.')
					throw new Error('Invalid email or password.')
				}
				throw new Error('Unable to sign in right now.')
			}
			return (await response.json()) as { token: string; record: AuthModel }
		},
		() => rememberSignIn({ method: 'email' })
	)
}
