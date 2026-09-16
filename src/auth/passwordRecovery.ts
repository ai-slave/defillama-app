import PocketBase, { BaseAuthStore, ClientResponseError } from 'pocketbase'
import { POCKETBASE_URL } from '~/constants'

export async function requestPasswordReset(email: string, signal?: AbortSignal) {
	const client = new PocketBase(POCKETBASE_URL, new BaseAuthStore())
	try {
		await client.collection('users').requestPasswordReset(email, { requestKey: null, signal })
	} catch (error) {
		if (error instanceof ClientResponseError && error.status === 429) {
			throw new Error('Too many reset requests. Please wait before trying again.', { cause: error })
		}
		throw new Error('Could not request a reset link. Check your connection.', { cause: error })
	}
}
