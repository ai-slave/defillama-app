import { describe, expect, test } from 'vitest'
import { readCloudflareCountry, visitorAudience, visitorRegionRoute } from '~/server/visitorRegionRoute'

function request(headers: Record<string, string | Array<string> | undefined> = {}) {
	return {
		method: 'GET',
		url: '/api/dynamic/visitor-region',
		query: {},
		headers
	}
}

describe('visitorRegionRoute', () => {
	test('returns the visitor country and EU audience', async () => {
		const result = await visitorRegionRoute.handle(request({ 'cf-ipcountry': 'de' }))

		expect(result).toEqual({
			status: 200,
			body: { country: 'DE', audience: 'eu' },
			headers: {
				'Cache-Control': 'private, no-store, max-age=0',
				'X-Visitor-Country': 'DE'
			}
		})
	})

	test('fails closed when the header is missing', async () => {
		const result = await visitorRegionRoute.handle(request())

		expect(result).toEqual({
			status: 200,
			body: { country: null, audience: 'unknown' },
			headers: { 'Cache-Control': 'private, no-store, max-age=0' }
		})
	})

	test('does not echo malformed header values', () => {
		expect(readCloudflareCountry('not-a-country')).toBeNull()
		expect(readCloudflareCountry(['fr', 'us'])).toBe('FR')
		expect(readCloudflareCountry('T1')).toBe('T1')
	})

	test('classifies non-EU and Cloudflare special country codes', () => {
		expect(visitorAudience('US')).toBe('rest')
		expect(visitorAudience('XX')).toBe('unknown')
		expect(visitorAudience('T1')).toBe('unknown')
	})
})
