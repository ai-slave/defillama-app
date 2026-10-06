import { sendClaimToDiscord } from '~/containers/MarketMakers/server/claimDiscord'
import type { ApiRequest } from '~/server/api/types'
import { defineApiRoute } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import { sendClaimToUserAnalytics } from './userAnalytics'

const FORGD_PROD_CLAIM_BASE = 'https://quant.forgd.com/api/v1/public'
export type UtrClaimUpstreamConfig = { baseUrl: string; apiKey: string }
export type UtrClaimProxyResult = { status: number; body: unknown }

export function getUtrClaimUpstreamConfig(): UtrClaimUpstreamConfig | null {
	const prodKey = process.env.API_KEY_FORGD?.trim()
	return prodKey ? { baseUrl: FORGD_PROD_CLAIM_BASE, apiKey: prodKey } : null
}

export function utrClaimUpstreamUrl(path: '/utr/claim' | '/utr/claim/documents'): string | null {
	const config = getUtrClaimUpstreamConfig()
	return config ? `${config.baseUrl}${path}` : null
}

function isBody(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === 'object' && !Array.isArray(value)
}

function claimRequestId(value: unknown): string | null {
	if (!isBody(value)) return null
	return typeof value.id === 'string' && value.id.trim() ? value.id.trim() : null
}

function upstreamMessage(body: unknown): string | null {
	if (!body || typeof body !== 'object') return null
	const record = body as Record<string, unknown>
	if (typeof record.message === 'string') return record.message
	if (typeof record.error === 'string') return record.error
	if (record.error && typeof record.error === 'object') {
		const message = (record.error as Record<string, unknown>).message
		if (typeof message === 'string') return message
	}
	return null
}

export async function mapUtrClaimUpstreamResponse(response: Response): Promise<UtrClaimProxyResult> {
	const body = await response.json().catch(() => null)
	if (response.status === 201) return { status: 201, body }
	if ([400, 411, 413, 429].includes(response.status)) {
		return { status: response.status, body: { error: upstreamMessage(body) ?? 'Claim request was rejected' } }
	}
	if (response.status === 503) {
		return { status: 503, body: { error: 'Claim service is temporarily unavailable — please try again' } }
	}
	return { status: 502, body: { error: 'Failed to submit the claim request' } }
}

async function proxyUtrClaim(payload: Record<string, unknown>): Promise<UtrClaimProxyResult> {
	const config = getUtrClaimUpstreamConfig()
	if (!config) return { status: 502, body: { error: 'Claim service is not configured' } }
	try {
		const response = await fetch(`${config.baseUrl}/utr/claim`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(30_000)
		})
		return await mapUtrClaimUpstreamResponse(response)
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute')
		return { status: 502, body: { error: 'Failed to submit the claim request' } }
	}
}

export const utrClaimSubmit = defineApiRoute({
	route: '/api/public/utr/claim',
	methods: ['POST'],
	cacheControl: 'no-store',
	handle: async (req: ApiRequest) => {
		if (!isBody(req.body)) return { status: 400, body: { error: 'Invalid claim request' } }
		void sendClaimToUserAnalytics(req.body)
		const result = await proxyUtrClaim(req.body)
		await sendClaimToDiscord(
			req.body,
			'utr',
			result.status === 201
				? { ok: true, requestId: claimRequestId(result.body) }
				: { ok: false, reason: 'forgd_failed' }
		)
		return result
	}
})
