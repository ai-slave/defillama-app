import { AUTH_SERVER, POCKETBASE_URL } from '~/constants'
import { fetchWithPoolingOnServer } from '~/utils/http-client'

type SqlExecutionAccess = { valid: true; userId: string } | { valid: false; status: number; error: string }

export async function getSqlExecutionAccess(authorization: string | undefined): Promise<SqlExecutionAccess> {
	if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ') || !authorization.slice(7).trim()) {
		return { valid: false, status: 401, error: 'Authentication required to run SQL.' }
	}
	try {
		const userResponse = await fetchWithPoolingOnServer(`${POCKETBASE_URL}/api/collections/users/auth-refresh`, {
			method: 'POST',
			headers: { Authorization: authorization },
			timeout: 15_000
		})
		if (!userResponse.ok) return { valid: false, status: 401, error: 'Invalid authentication.' }
		const { record } = await userResponse.json()
		if (typeof record?.id !== 'string' || !record.id) {
			return { valid: false, status: 401, error: 'Invalid authentication.' }
		}
		if (record.flags?.is_llama === true) return { valid: true, userId: record.id }
		const denied = { valid: false, status: 403, error: 'An active API subscription is required to run SQL.' } as const
		if (record.flags?.is_trial === true) return denied
		const subscriptionResponse = await fetchWithPoolingOnServer(`${AUTH_SERVER}/subscription/status`, {
			method: 'POST',
			headers: { Authorization: authorization, 'Content-Type': 'application/json' },
			timeout: 15_000
		})
		if (!subscriptionResponse.ok) return denied
		const { subscription } = await subscriptionResponse.json()
		if (subscription?.type !== 'api' || subscription?.status !== 'active') return denied
		return { valid: true, userId: record.id }
	} catch {
		return { valid: false, status: 503, error: 'Unable to verify SQL access. Please try again.' }
	}
}
