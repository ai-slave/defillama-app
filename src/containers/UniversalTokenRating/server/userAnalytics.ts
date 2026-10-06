import { recordRouteRuntimeError } from '~/utils/telemetry'

const USER_ANALYTICS_TIMEOUT_MS = 2000

export async function sendClaimToUserAnalytics(payload: Record<string, unknown>): Promise<void> {
	const baseUrl = process.env.USER_ANALYTICS_URL?.trim()
	const sharedSecret = process.env.UTR_CLAIMS_SHARED_SECRET?.trim()
	if (!baseUrl || !sharedSecret) return

	try {
		const response = await fetch(`${baseUrl}/api/ingestion/utr-claims`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Shared-Secret': sharedSecret
			},
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(USER_ANALYTICS_TIMEOUT_MS)
		})
		if (!response.ok) throw new Error(`User Analytics returned HTTP ${response.status}`)
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute')
	}
}
