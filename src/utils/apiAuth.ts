import { AUTH_SERVER, FEATURES_SERVER, POCKETBASE_URL } from '~/constants'
import { fetchWithPoolingOnServer } from '~/utils/http-client'

type ValidationSuccess = { valid: true; isTrial: boolean }
type ValidationFailure = { valid: false; status: 401 | 403; error: string }
type ValidationUnavailable = { valid: false; status: 503; error: string }
export type ValidationResult = ValidationSuccess | ValidationFailure | ValidationUnavailable

export async function validateSubscription(authHeader: string | undefined): Promise<ValidationResult> {
	if (!authHeader?.startsWith('Bearer ')) {
		return { valid: false, status: 401, error: 'Authentication required' }
	}

	const [subResponse, userResponse] = await Promise.all([
		fetchWithPoolingOnServer(`${AUTH_SERVER}/subscription/status`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: authHeader
			}
		}),
		fetchWithPoolingOnServer(`${POCKETBASE_URL}/api/collections/users/auth-refresh`, {
			method: 'POST',
			headers: { Authorization: authHeader }
		}).catch(() => null)
	])

	if (!subResponse.ok) {
		if (![401, 403, 404].includes(subResponse.status)) {
			return { valid: false, status: 503, error: 'Subscription service unavailable' }
		}
		return { valid: false, status: 403, error: 'Invalid subscription' }
	}

	const subData = await subResponse.json()
	if (subData?.subscription?.status !== 'active') {
		return { valid: false, status: 403, error: 'Active subscription required' }
	}

	let isTrial = false
	if (userResponse?.ok) {
		const userData = await userResponse.json()
		isTrial = Boolean(userData?.record?.flags?.is_trial)
	}

	return { valid: true, isTrial }
}
export async function trackCsvDownload(authHeader: string): Promise<void> {
	await fetchWithPoolingOnServer(`${FEATURES_SERVER}/user/track-csv-download`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: authHeader
		}
	}).catch(() => {})
}
