import type { AuthRecord } from 'pocketbase'
import pb, { type AuthModel } from '~/utils/pocketbase'

const serverSnapshot: { token: string; record: AuthRecord; isValid: boolean } = {
	token: '',
	record: null,
	isValid: false
}
let snapshot = {
	token: pb.authStore.token,
	record: pb.authStore.record ? { ...pb.authStore.record } : null,
	isValid: pb.authStore.isValid
}
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
	// PocketBase owns persistence and cross-tab changes. Publish only after the SSR cookie agrees.
	// Browsers drop a Secure cookie over plain http, hiding the session from SSR in dev.
	const secure = process.env.NODE_ENV === 'development' && window.location.protocol !== 'https:' ? '' : '; Secure'
	pb.authStore.onChange((token, record) => {
		const isValid = pb.authStore.isValid
		document.cookie = isValid
			? `pb_auth_token=${token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`
			: `pb_auth_token=; path=/; max-age=0; SameSite=Lax${secure}`
		snapshot = { token, record: record ? { ...record } : null, isValid }
		for (const listener of listeners) listener()
	}, true)
}

export function subscribeToAuthStore(listener: () => void) {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

export const getAuthStoreSnapshot = () => snapshot
export const getServerSnapshot = () => serverSnapshot

// pb.collection('users').authRefresh() writes the response into the shared auth
// store before its promise resolves, so a slow response can resurrect a session
// the user already logged out of or switched away from. Send the refresh pinned
// to the token that initiated it and commit only while that session is still
// the current one.
export async function refreshSession(sessionToken: string = pb.authStore.token): Promise<AuthModel | null> {
	if (!sessionToken) return null
	const result = await pb.send<{ token: string; record: AuthModel }>('/api/collections/users/auth-refresh', {
		method: 'POST',
		headers: { Authorization: sessionToken }
	})
	if (pb.authStore.token === sessionToken) {
		pb.authStore.save(result.token, result.record)
	}
	return result.record
}
