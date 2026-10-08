import { sendClaimToUserAnalytics } from '~/containers/UniversalTokenRating/server/userAnalytics'
import { badRequest, ok, upstreamError } from '~/server/api/respond'
import { defineApiRoute } from '~/server/api/types'
import type { ApiRequest, ApiResult } from '~/server/api/types'
import { EMAIL_PATTERN } from '~/utils/email'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import { normalizeSocialUrl, SOCIAL_PROFILE_PATTERN } from '../leadShared'
import { sendClaimToDiscord, type ClaimSubmissionSource } from './claimDiscord'
import { isClaimTurnstileEnabled, verifyClaimTurnstile } from './claimTurnstile'
import { forgdPost } from './client'

const MM_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export const CONNECT_INTERESTS = ['engage-market-maker', 'treasury-management', 'other'] as const
export const TOKEN_STATUSES = ['pre-tge', 'listed', 'no-token'] as const

const RATE_WINDOW_MS = 10 * 60 * 1000
const LEAD_RATE_LIMIT = 5
const CTA_RATE_LIMIT = 30

const rateBuckets = new Map<string, Array<number>>()

function isRateLimited(bucket: string, limit: number): boolean {
	const now = Date.now()
	const hits = (rateBuckets.get(bucket) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
	if (hits.length >= limit) {
		rateBuckets.set(bucket, hits)
		return true
	}
	hits.push(now)
	rateBuckets.set(bucket, hits)
	if (rateBuckets.size > 10_000) {
		for (const [key, times] of rateBuckets) {
			if (times.every((t) => now - t >= RATE_WINDOW_MS)) rateBuckets.delete(key)
		}
	}
	return false
}

function headerValue(req: ApiRequest, name: string): string | undefined {
	const value = req.headers[name]
	return Array.isArray(value) ? value[0] : value
}

// The leftmost x-forwarded-for entry is client-controlled; only edge-set headers
// (or the entry appended by our own proxy) are trustworthy for rate limiting.
export function clientIp(req: ApiRequest): string {
	const direct = headerValue(req, 'cf-connecting-ip')?.trim() || headerValue(req, 'x-real-ip')?.trim()
	if (direct) return direct
	const forwarded = headerValue(req, 'x-forwarded-for')
	return forwarded?.split(',').at(-1)?.trim() || 'unknown'
}

function tooManyRequests(): ApiResult {
	return {
		status: 429,
		body: { error: 'Too many requests, try again later' },
		headers: { 'Cache-Control': 'no-store' }
	}
}

type Body = Record<string, unknown>

function asBody(value: unknown): Body {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Body) : {}
}

function str(body: Body, key: string, maxLength = 200): string | null {
	const value = body[key]
	if (typeof value !== 'string') return null
	const trimmed = value.trim()
	return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null
}

type Validated = { ok: true; payload: Body } | { ok: false; error: string }

function commonLeadFields(body: Body): Validated {
	if (typeof body.hp === 'string' && body.hp.trim() !== '') return { ok: false, error: 'Invalid submission' }
	const marketMakerId = str(body, 'market_maker_id', 64)
	if (marketMakerId && !MM_ID_PATTERN.test(marketMakerId)) return { ok: false, error: 'Invalid market maker id' }
	return {
		ok: true,
		payload: {
			market_maker_id: marketMakerId,
			market_maker_name: str(body, 'market_maker_name'),
			click_id: str(body, 'click_id', 128),
			source_url: str(body, 'source_url', 500)
		}
	}
}

export function validateConnectBody(raw: unknown): Validated {
	const body = asBody(raw)
	const common = commonLeadFields(body)
	if (!common.ok) return common

	const interest = str(body, 'interest', 64)
	if (!interest || !(CONNECT_INTERESTS as ReadonlyArray<string>).includes(interest)) {
		return { ok: false, error: 'Invalid interest' }
	}
	const fullName = str(body, 'full_name')
	if (!fullName) return { ok: false, error: 'Full name is required' }
	const email = str(body, 'email', 320)
	if (!email || !EMAIL_PATTERN.test(email)) return { ok: false, error: 'Invalid email' }

	const tokenStatus = str(body, 'token_status', 32)
	if (tokenStatus && !(TOKEN_STATUSES as ReadonlyArray<string>).includes(tokenStatus)) {
		return { ok: false, error: 'Invalid token status' }
	}

	return {
		ok: true,
		payload: {
			...common.payload,
			interest,
			full_name: fullName,
			email,
			token_status: tokenStatus,
			project_name: str(body, 'project_name'),
			token_ticker: str(body, 'token_ticker', 32),
			coingecko_id: tokenStatus === 'listed' ? str(body, 'coingecko_id', 128) : null
		}
	}
}

export function validateClaimBody(raw: unknown): Validated {
	const body = asBody(raw)
	const common = commonLeadFields(body)
	if (!common.ok) return common

	const position = str(body, 'position')
	if (!position) return { ok: false, error: 'Position is required' }
	const fullName = str(body, 'full_name')
	if (!fullName) return { ok: false, error: 'Full name is required' }
	const organizationEmail = str(body, 'organization_email', 320)
	if (!organizationEmail || !EMAIL_PATTERN.test(organizationEmail)) {
		return { ok: false, error: 'Invalid organization email' }
	}
	const socialProfileUrl = str(body, 'social_profile_url', 500)
	if (!socialProfileUrl || !SOCIAL_PROFILE_PATTERN.test(socialProfileUrl)) {
		return { ok: false, error: 'Social profile must be a LinkedIn or X profile URL' }
	}
	if (typeof body.has_forgd_contact !== 'boolean') return { ok: false, error: 'Invalid Forgd contact flag' }
	if (body.alignment_consent !== true || body.terms_consent !== true) {
		return { ok: false, error: 'Both consents are required' }
	}

	return {
		ok: true,
		payload: {
			...common.payload,
			position,
			full_name: fullName,
			organization_email: organizationEmail,
			social_profile_url: normalizeSocialUrl(socialProfileUrl),
			has_forgd_contact: body.has_forgd_contact,
			forgd_contact_name: body.has_forgd_contact ? str(body, 'forgd_contact_name') : null,
			telegram: str(body, 'telegram', 64),
			alignment_consent: true,
			terms_consent: true
		}
	}
}

type LeadRouteOptions = {
	requireCaptcha?: boolean
	mirrorUtrClaim?: boolean
	notifyDiscord?: boolean
}

function claimSubmissionSource(body: Body): ClaimSubmissionSource {
	return body.analytics_source === 'utr' ? 'utr' : 'market-maker'
}

function requestId(value: unknown): string | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	const id = (value as Record<string, unknown>).request_id
	return typeof id === 'string' && id.trim() ? id.trim() : null
}

function leadRoute(
	route: string,
	forgdPath: string,
	validate: (raw: unknown) => Validated,
	options: LeadRouteOptions = {}
) {
	return defineApiRoute({
		route,
		methods: ['POST'],
		cacheControl: 'no-store',
		handle: async (req) => {
			if (isRateLimited(`${route}:${clientIp(req)}`, LEAD_RATE_LIMIT)) return tooManyRequests()
			const body = asBody(req.body)
			const validated = validate(req.body)
			if (validated.ok === false) return badRequest(validated.error)
			if (options.requireCaptcha && isClaimTurnstileEnabled()) {
				const captcha = await verifyClaimTurnstile(body.turnstile_token, clientIp(req))
				if (captcha.ok === false) {
					if (captcha.reason === 'invalid') return badRequest('Complete the CAPTCHA verification and try again')
					recordRouteRuntimeError(new Error('Claim CAPTCHA verification is unavailable'), 'apiRoute')
					return upstreamError('CAPTCHA verification is unavailable')
				}
			}
			if (options.mirrorUtrClaim && body.analytics_source === 'utr') {
				void sendClaimToUserAnalytics(validated.payload)
			}
			try {
				const result = await forgdPost(forgdPath, validated.payload)
				if (options.notifyDiscord) {
					await sendClaimToDiscord(validated.payload, claimSubmissionSource(body), {
						ok: true,
						requestId: requestId(result)
					})
				}
				return ok(result, { 'Cache-Control': 'no-store' })
			} catch (error) {
				recordRouteRuntimeError(error, 'apiRoute')
				if (options.notifyDiscord) {
					await sendClaimToDiscord(validated.payload, claimSubmissionSource(body), {
						ok: false,
						reason: 'forgd_failed'
					})
				}
				return upstreamError('Failed to submit request')
			}
		}
	})
}

export const leadConnect = leadRoute(
	'/api/public/market-makers/lead/connect',
	'/affiliate/lead/connect',
	validateConnectBody
)
export const leadClaim = leadRoute('/api/public/market-makers/lead/claim', '/affiliate/lead/claim', validateClaimBody, {
	requireCaptcha: true,
	mirrorUtrClaim: true,
	notifyDiscord: true
})

export const leadCta = defineApiRoute({
	route: '/api/public/market-makers/cta',
	methods: ['POST'],
	cacheControl: 'no-store',
	handle: async (req) => {
		if (isRateLimited(`cta:${clientIp(req)}`, CTA_RATE_LIMIT)) return tooManyRequests()
		const body = asBody(req.body)
		const kind = str(body, 'kind', 16)
		if (kind !== 'connect' && kind !== 'claim') return badRequest('Invalid cta kind')
		const marketMakerId = str(body, 'market_maker_id', 64)
		if (marketMakerId && !MM_ID_PATTERN.test(marketMakerId)) return badRequest('Invalid market maker id')
		try {
			const result = await forgdPost<{ click_id?: string }>('/affiliate/cta', {
				event_type: 'cta_click',
				cta_id: `mm-${kind}-drawer`,
				target_url: 'https://www.forgd.com',
				source_url: str(body, 'source_url', 500),
				payload: marketMakerId ? { market_maker_id: marketMakerId } : {}
			})
			return ok({ clickId: result.click_id ?? null }, { 'Cache-Control': 'no-store' })
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to record cta')
		}
	}
})
