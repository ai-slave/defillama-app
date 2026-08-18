import { ok } from '~/server/api/respond'
import { defineApiRoute } from '~/server/api/types'
import { EU_COUNTRY_CODE_SET } from '~/utils/countries'

export type VisitorAudience = 'eu' | 'rest' | 'unknown'

const VISITOR_REGION_CACHE_CONTROL = 'private, no-store, max-age=0'
export function readCloudflareCountry(value: string | string[] | undefined): string | null {
	const raw = Array.isArray(value) ? value[0] : value
	const country = raw?.trim().toUpperCase()

	// Cloudflare sends ISO 3166-1 alpha-2 codes, XX for unknown, and T1 for Tor.
	return country && (/^[A-Z]{2}$/.test(country) || country === 'T1') ? country : null
}

export function visitorAudience(country: string | null): VisitorAudience {
	if (!country || country === 'XX' || country === 'T1') return 'unknown'
	return EU_COUNTRY_CODE_SET.has(country) ? 'eu' : 'rest'
}

export const visitorRegionRoute = defineApiRoute({
	route: '/api/dynamic/visitor-region',
	methods: ['GET'],
	handle: async (req) => {
		const country = readCloudflareCountry(req.headers['cf-ipcountry'])

		return ok(
			{
				country,
				audience: visitorAudience(country)
			},
			{
				'Cache-Control': VISITOR_REGION_CACHE_CONTROL,
				...(country ? { 'X-Visitor-Country': country } : {})
			}
		)
	}
})
