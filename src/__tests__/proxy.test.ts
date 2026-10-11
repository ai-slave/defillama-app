import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
	AB_GROUP_COOKIE_NAME,
	AB_SEED_COOKIE_NAME,
	AB_VISITOR_COOKIE_NAME,
	getABGroup,
	getABSeedFromCookie,
	isABVisitorId
} from '~/utils/abTesting'

async function loadProxy(allowedOrigins = '', investorsPreview = '') {
	vi.resetModules()
	vi.stubEnv('CORS_ALLOWED_ORIGINS', allowedOrigins)
	vi.stubEnv('NEXT_PUBLIC_INVESTORS_PREVIEW', investorsPreview)
	vi.stubEnv('NEXT_PUBLIC_INVESTORS_SITE', '')
	vi.stubEnv('NEXT_PUBLIC_SUPERLUMINAL_DASHBOARD_ID', '')
	return import('~/proxy')
}

function apiRequest(origin: string, method = 'POST', path = '/api/private/token-usage/BTC') {
	return new NextRequest(`https://defillama.com${path}`, {
		method,
		headers: { origin }
	})
}

function pageRequest(url: string, cookie?: string, accept = 'text/html') {
	return new NextRequest(url, {
		headers: { host: new URL(url).host, accept, ...(cookie ? { cookie } : {}) }
	})
}

function rewriteUrl(response: Response) {
	return response.headers.get('x-middleware-rewrite')
}

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('api proxy CORS', () => {
	test('allows same-origin API POST requests with an Origin header', async () => {
		const { proxy } = await loadProxy()

		const response = proxy(apiRequest('https://defillama.com'))

		expect(response.status).not.toBe(403)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://defillama.com')
	})

	test('allows configured cross-origin API requests', async () => {
		const { proxy } = await loadProxy('https://integrator.example')

		const response = proxy(apiRequest('https://integrator.example'))

		expect(response.status).not.toBe(403)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://integrator.example')
	})

	test('denies unconfigured cross-origin API requests', async () => {
		const { proxy } = await loadProxy('https://integrator.example')

		const response = proxy(apiRequest('https://unknown.example'))

		expect(response.status).toBe(403)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
	})

	test('allows any origin for canonical public API requests without varying by Origin', async () => {
		const { proxy } = await loadProxy('https://integrator.example')

		const response = proxy(apiRequest('https://unknown.example', 'GET', '/api/public/protocols/charts'))

		expect(response.status).not.toBe(403)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
		expect(response.headers.get('Vary') ?? '').not.toContain('Origin')
	})

	test('keeps configured-origin CORS for private and dynamic API requests', async () => {
		const { proxy } = await loadProxy('https://integrator.example')

		const privateResponse = proxy(apiRequest('https://unknown.example', 'GET', '/api/private/token-usage/BTC'))
		const dynamicResponse = proxy(
			apiRequest('https://unknown.example', 'GET', '/api/dynamic/pro-dashboard/public-id/stream')
		)

		expect(privateResponse.status).toBe(403)
		expect(dynamicResponse.status).toBe(403)
		expect(privateResponse.headers.get('Access-Control-Allow-Origin')).toBeNull()
		expect(dynamicResponse.headers.get('Access-Control-Allow-Origin')).toBeNull()
	})

	test('handles preflight for public, private, and dynamic API groups', async () => {
		const { proxy } = await loadProxy('https://integrator.example')

		const publicResponse = proxy(apiRequest('https://unknown.example', 'OPTIONS', '/api/public/protocols/charts'))
		const privateResponse = proxy(apiRequest('https://integrator.example', 'OPTIONS', '/api/private/token-usage/BTC'))
		const dynamicResponse = proxy(
			apiRequest('https://integrator.example', 'OPTIONS', '/api/dynamic/pro-dashboard/public-id/stream')
		)

		expect(publicResponse.status).toBe(204)
		expect(publicResponse.headers.get('Access-Control-Allow-Origin')).toBe('*')
		expect(publicResponse.headers.get('Vary') ?? '').not.toContain('Origin')
		expect(privateResponse.status).toBe(204)
		expect(privateResponse.headers.get('Access-Control-Allow-Origin')).toBe('https://integrator.example')
		expect(privateResponse.headers.get('Vary')).toContain('Origin')
		expect(dynamicResponse.status).toBe(204)
		expect(dynamicResponse.headers.get('Access-Control-Allow-Origin')).toBe('https://integrator.example')
		expect(dynamicResponse.headers.get('Vary')).toContain('Origin')
	})
})

describe('a/b assignment', () => {
	test('assigns a stable 50/50 group cookie to new main-site visitors', async () => {
		const { proxy } = await loadProxy()
		const response = proxy(pageRequest('https://defillama.com/chains'))
		const visitorCookie = response.cookies.get(AB_VISITOR_COOKIE_NAME)
		const groupCookie = response.cookies.get(AB_GROUP_COOKIE_NAME)

		expect(isABVisitorId(visitorCookie?.value)).toBe(true)
		expect(groupCookie?.value).toBe(getABGroup(visitorCookie!.value))
		expect(visitorCookie).toMatchObject({ httpOnly: true, path: '/', sameSite: 'lax', secure: true })
		expect(groupCookie).toMatchObject({ path: '/', sameSite: 'lax', secure: true })
		expect(response.headers.get('Cache-Control')).toBe('private, no-store')
	})

	test('gives new visitors a seed the browser can read, equal to the visitor id, so signed-out analytics can join to the user later', async () => {
		const { proxy } = await loadProxy()
		const response = proxy(pageRequest('https://defillama.com/chains'))
		// document.cookie only exposes the cookies set without HttpOnly.
		const documentCookie = response.cookies
			.getAll()
			.filter((cookie) => !cookie.httpOnly)
			.map((cookie) => `${cookie.name}=${cookie.value}`)
			.join('; ')

		expect(getABSeedFromCookie(documentCookie)).toBe(response.cookies.get(AB_VISITOR_COOKIE_NAME)?.value)
		expect(response.cookies.get(AB_SEED_COOKIE_NAME)).toMatchObject({ path: '/', sameSite: 'lax', secure: true })
	})

	test('backfills the readable seed for visitors assigned before the seed existed, without rebucketing them', async () => {
		const { proxy } = await loadProxy()
		const visitorId = '00000000-0000-4000-8000-000000000009'
		const response = proxy(
			pageRequest('https://defillama.com/chains', `${AB_VISITOR_COOKIE_NAME}=${visitorId}; ${AB_GROUP_COOKIE_NAME}=b`)
		)

		expect(response.cookies.get(AB_SEED_COOKIE_NAME)?.value).toBe(visitorId)
		expect(response.cookies.get(AB_VISITOR_COOKIE_NAME)).toBeUndefined()
		expect(response.cookies.get(AB_GROUP_COOKIE_NAME)).toBeUndefined()
		expect(response.headers.get('Cache-Control')).toBe('private, no-store')
	})

	test('keeps an existing valid assignment without resetting cookies', async () => {
		const { proxy } = await loadProxy()
		const visitorId = '00000000-0000-4000-8000-000000000009'
		const response = proxy(
			pageRequest(
				'https://defillama.com/chains',
				`${AB_VISITOR_COOKIE_NAME}=${visitorId}; ${AB_GROUP_COOKIE_NAME}=b; ${AB_SEED_COOKIE_NAME}=${visitorId}`
			)
		)

		expect(response.cookies.get(AB_VISITOR_COOKIE_NAME)).toBeUndefined()
		expect(response.cookies.get(AB_GROUP_COOKIE_NAME)).toBeUndefined()
		expect(response.cookies.get(AB_SEED_COOKIE_NAME)).toBeUndefined()
		expect(response.headers.get('Cache-Control')).toBeNull()
	})

	test('does not assign groups to non-HTML requests', async () => {
		const { proxy } = await loadProxy()
		const response = proxy(pageRequest('https://defillama.com/chains', undefined, '*/*'))

		expect(response.cookies.get(AB_VISITOR_COOKIE_NAME)).toBeUndefined()
		expect(response.cookies.get(AB_GROUP_COOKIE_NAME)).toBeUndefined()
	})
})

describe('investors proxy routing', () => {
	test('serves both sites in the same process without a site env', async () => {
		const { proxy, config } = await loadProxy()
		const cases = [
			['investors', '/', '/investors'],
			['enterprise', '/', '/investors'],
			['investors', '/all', '/investors/all'],
			['enterprise', '/all', '/investors/odyssey-ecosystem'],
			['investors', '/spark', '/investors/spark'],
			['enterprise', '/odyssey-ecosystem', '/investors/odyssey-ecosystem'],
			['investors', '/odyssey-ecosystem', '/404'],
			['enterprise', '/spark', '/404'],
			['investors', '/sonic', '/investors/sonic'],
			['investors', '/near', '/investors/near'],
			['investors', '/thorchain', '/investors/thorchain'],
			['investors', '/flare', '/investors/flare'],
			['enterprise', '/flare', '/404'],
			['enterprise', '/thorchain', '/404'],
			['investors', '/kpk', '/investors/kpk'],
			['investors', '/uniswap', '/404'],
			['enterprise', '/kpk', '/404'],
			['investors', '/etherfi', '/404'],
			['investors', '/maple', '/404'],
			['investors', '/berachain', '/404'],
			['investors', '/aave', '/404']
		]

		for (const [site, path, destination] of cases) {
			// These paths must also match Next data/client-navigation requests without an HTML accept header.
			expect(config.matcher).toContain(path)
			const origin = `https://${site}.defillama.com`
			const response = proxy(pageRequest(`${origin}${path}`, undefined, '*/*'))
			expect(rewriteUrl(response)).toBe(`${origin}${destination}`)
			expect(response.cookies.get(AB_VISITOR_COOKIE_NAME)).toBeUndefined()
		}
	})

	test('routes both public IR sites behind the LB technical host, including Next data', async () => {
		const { proxy } = await loadProxy()
		const cases = [
			['investors.defillama.com', '/', '/investors'],
			['enterprise.defillama.com', '/', '/investors'],
			['investors.defillama.com', '/all', '/investors/all'],
			['enterprise.defillama.com', '/all', '/investors/odyssey-ecosystem'],
			['investors.defillama.com', '/spark', '/investors/spark'],
			['enterprise.defillama.com', '/spark', '/404'],
			['enterprise.defillama.com', '/odyssey-ecosystem', '/investors/odyssey-ecosystem'],
			['investors.defillama.com', '/odyssey-ecosystem', '/404'],
			['investors.defillama.com', '/_next/data/build-id/spark.json', '/_next/data/build-id/investors/spark.json']
		]
		for (const [publicHost, path, destination] of cases) {
			const request = pageRequest(`http://app-origin.example${path}?tab=revenue`, undefined, '*/*')
			request.headers.set('x-forwarded-host', publicHost)
			expect(rewriteUrl(proxy(request))).toBe(`http://app-origin.example${destination}?tab=revenue`)
		}
		const main = pageRequest('http://app-origin.example/')
		main.headers.set('x-forwarded-host', 'defillama.com')
		expect(rewriteUrl(proxy(main))).toBeNull()
	})

	test('preserves query strings through rewrites', async () => {
		const { proxy } = await loadProxy()
		for (const path of ['/', '/all', '/spark']) {
			const response = proxy(pageRequest(`https://investors.defillama.com${path}?tab=revenue&from=landing`))
			expect(new URL(rewriteUrl(response)!).search).toBe('?tab=revenue&from=landing')
		}
	})

	test('keeps the main site, unknown hosts, API routes and assets out of IR rewrites', async () => {
		const { proxy } = await loadProxy()
		for (const url of [
			'https://defillama.com/',
			'https://defillama.com/all',
			'https://www.defillama.com/spark',
			'https://unknown.example/',
			'https://unknown.example/yields',
			'https://investors.defillama.com/api/public/protocols/charts',
			'https://investors.defillama.com/_next/static/chunk.js',
			'https://enterprise.defillama.com/assets/defillama.webp'
		]) {
			expect(rewriteUrl(proxy(pageRequest(url)))).toBeNull()
		}
	})

	test('falls back to path-based IR routing while the LB host is opaque', async () => {
		const { proxy } = await loadProxy()
		const cases = [
			['/spark', '/investors/spark'],
			['/odyssey-ecosystem', '/investors/odyssey-ecosystem'],
			['/all', '/investors/all'],
			['/kpk', '/investors/kpk'],
			['/uniswap', null],
			['/', null],
			['/_next/data/build-id/spark.json', '/_next/data/build-id/investors/spark.json']
		] as const
		for (const [path, destination] of cases) {
			const request = pageRequest(`http://app-origin.example${path}?tab=revenue`, undefined, '*/*')
			request.headers.set('x-forwarded-host', 'app-origin.example')
			expect(rewriteUrl(proxy(request))).toBe(
				destination ? `http://app-origin.example${destination}?tab=revenue` : null
			)
		}
		const main = pageRequest('http://app-origin.example/spark')
		main.headers.set('x-forwarded-host', 'defillama.com')
		expect(rewriteUrl(proxy(main))).toBeNull()
	})

	test('uses Host rather than a forwarded-host override', async () => {
		const { proxy } = await loadProxy()
		const request = pageRequest('https://enterprise.defillama.com/odyssey-ecosystem')
		request.headers.set('x-forwarded-host', 'investors.defillama.com')
		expect(rewriteUrl(proxy(request))).toBe('https://enterprise.defillama.com/investors/odyssey-ecosystem')
	})

	test('enables preview projects only on the investors host', async () => {
		const { proxy } = await loadProxy('', 'true')
		for (const project of ['uniswap']) {
			expect(rewriteUrl(proxy(pageRequest(`https://investors.defillama.com/${project}`)))).toBe(
				`https://investors.defillama.com/investors/${project}`
			)
			expect(rewriteUrl(proxy(pageRequest(`https://enterprise.defillama.com/${project}`)))).toBe(
				'https://enterprise.defillama.com/404'
			)
		}
	})
})

describe('old terminal links', () => {
	test('redirect to the terminal path, keeping only an encoded entry coin', async () => {
		const { proxy } = await loadProxy()

		const newChat = proxy(pageRequest('https://defillama.com/ai/chat?view=terminal&symbol=xyz:TSLA'))
		expect(newChat.status).toBe(307)
		expect(newChat.headers.get('location')).toBe('https://defillama.com/ai/terminal?symbol=xyz%3ATSLA')

		const session = proxy(pageRequest('https://defillama.com/ai/chat/abc?view=terminal&symbol=ETH'))
		expect(session.headers.get('location')).toBe('https://defillama.com/ai/terminal/abc')
	})

	test('leave shared links and plain chat links alone', async () => {
		const { proxy } = await loadProxy()

		expect(
			proxy(pageRequest('https://defillama.com/ai/chat/shared/tok?view=terminal')).headers.get('location')
		).toBeNull()
		expect(proxy(pageRequest('https://defillama.com/ai/chat/abc')).headers.get('location')).toBeNull()
	})
})

describe('old /rwa perps links', () => {
	test('redirect to the Perps overview without the flag', async () => {
		const { proxy } = await loadProxy()

		const response = proxy(pageRequest('https://defillama.com/rwa?perps=true&groupBy=assetGroup'))
		expect(response.status).toBe(307)
		expect(response.headers.get('location')).toBe('https://defillama.com/rwa/perps?groupBy=assetGroup')
	})
})

describe('conversation paths', () => {
	test('return 404 past the session ID', async () => {
		const { proxy } = await loadProxy()

		for (const path of ['/ai/chat/abc/extra', '/ai/terminal/abc/extra', '/ai/chat/shared/tok/extra']) {
			expect(rewriteUrl(proxy(pageRequest(`https://defillama.com${path}`)))).toBe('https://defillama.com/404')
		}
	})

	test('reach the proxy from client navigation data requests', async () => {
		const { config } = await loadProxy()

		for (const url of [
			'https://defillama.com/_next/data/build-id/ai/chat/abc/extra.json',
			'https://defillama.com/_next/data/build-id/ai/terminal/abc/extra.json'
		]) {
			expect(unstable_doesMiddlewareMatch({ config, url, headers: { accept: '*/*' } })).toBe(true)
		}
	})

	test('serve New Chat, sessions and shared links', async () => {
		const { proxy } = await loadProxy()

		for (const path of ['/ai/chat', '/ai/chat/abc', '/ai/terminal', '/ai/terminal/abc', '/ai/chat/shared/tok']) {
			expect(rewriteUrl(proxy(pageRequest(`https://defillama.com${path}`)))).toBeNull()
		}
	})
})
