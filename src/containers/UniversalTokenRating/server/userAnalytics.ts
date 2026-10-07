import { FEATURES_SERVER } from '~/constants'
import { recordRouteRuntimeError } from '~/utils/telemetry'

// Allow one extra second for the relay around its two-second analytics timeout.
const USER_ANALYTICS_TIMEOUT_MS = 3000

export async function sendClaimToUserAnalytics(payload: Record<string, unknown>): Promise<void> {
	const sharedSecret = process.env.UTR_CLAIMS_SHARED_SECRET?.trim()
	if (!sharedSecret) return

	try {
		const response = await fetch(`${FEATURES_SERVER}/analytics/utr-claims`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Shared-Secret': sharedSecret
			},
			body: JSON.stringify(payload),
			redirect: 'error',
			signal: AbortSignal.timeout(USER_ANALYTICS_TIMEOUT_MS)
		})
		if (!response.ok) throw new Error(`Claim analytics relay returned HTTP ${response.status}`)
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute')
	}
}
