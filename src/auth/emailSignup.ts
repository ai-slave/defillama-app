import { acceptAuthSession, type AuthRequest } from '~/auth/authRequest'
import { rememberSignIn } from '~/auth/lastSignIn'
import { getReferrer } from '~/auth/referrer'
import { getSignupSource } from '~/auth/signupSource'
import { AUTH_SERVER } from '~/constants'

type SignupIdentity = { id: string; email: string; verified: boolean }
export type SignupRequest = AuthRequest & {
	email: string
	password: string
	passwordConfirm: string
	turnstileToken: string
	promotionalEmails: 'on' | 'off'
}

export function signupWithEmail(request: SignupRequest, onAccepted: (record: SignupIdentity) => void) {
	return acceptAuthSession(
		request,
		async () => {
			let response: Response
			try {
				response = await fetch(`${AUTH_SERVER}/auth/signup`, {
					method: 'POST',
					signal: request.signal,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						email: request.email,
						password: request.password,
						passwordConfirm: request.passwordConfirm,
						auth_method: 'email',
						source: getSignupSource(),
						referrer: getReferrer(),
						turnstile_token: request.turnstileToken,
						promotionalEmails: request.promotionalEmails,
						sendVerificationEmail: false
					})
				})
			} catch (error) {
				throw new Error(
					"We couldn't confirm whether your account was created. Check your connection, then try signing in before creating it again.",
					{ cause: error }
				)
			}
			if (!response.ok) {
				const body: { error?: string } = await response.json().catch(() => ({}))
				if (response.status === 429) throw new Error('Too many attempts. Please wait before trying again.')
				if (response.status === 400 && body.error) {
					// Validation errors arrive as JSON inside the error string; display the field messages.
					let validation: { data?: Record<string, { message: string }> } | null = null
					try {
						validation = JSON.parse(body.error)
					} catch {
						/* Other 400 responses contain plain text. */
					}
					if (validation?.data)
						throw new Error(
							Object.values(validation.data)
								.map((field) => field.message)
								.join('. ')
						)
					throw new Error(body.error)
				}
				throw new Error("We couldn't confirm whether your account was created. Try signing in, or try again later.")
			}
			const result: { token: string; user: SignupIdentity } = await response.json()
			return { token: result.token, record: result.user }
		},
		(record) => {
			rememberSignIn({ method: 'email' })
			onAccepted(record)
		}
	)
}
