import PocketBase, { BaseAuthStore, ClientResponseError } from 'pocketbase'
import { acceptAuthSession, type AuthRequest } from '~/auth/authRequest'
import { rememberSignIn } from '~/auth/lastSignIn'
import { POCKETBASE_URL } from '~/constants'
import type { AuthModel } from '~/utils/pocketbase'

export async function signInWithPassword({
	email,
	password,
	signal,
	canAccept,
	onAuthenticated
}: {
	email: string
	password: string
} & AuthRequest) {
	// The SDK saves before resolving. Keep that write private until the sheet accepts it.
	const client = new PocketBase(POCKETBASE_URL, new BaseAuthStore())
	return acceptAuthSession(
		{ signal, canAccept, onAuthenticated },
		async () => {
			try {
				return await client.collection<AuthModel>('users').authWithPassword(email, password, {
					// Otherwise PocketBase replaces the caller's abort signal with its own.
					requestKey: null,
					signal
				})
			} catch (error) {
				if (error instanceof ClientResponseError) {
					if (error.status === 400 || error.status === 401)
						throw new Error('Invalid email or password.', { cause: error })
					if (error.status === 429)
						throw new Error('Too many sign-in attempts. Please wait before trying again.', { cause: error })
					if (error.status === 0)
						throw new Error('Could not reach the sign-in service. Check your connection.', { cause: error })
				}
				throw new Error('Unable to sign in right now.', { cause: error })
			}
		},
		() => rememberSignIn({ method: 'email' })
	)
}
