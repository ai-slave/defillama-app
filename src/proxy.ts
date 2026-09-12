import { NextResponse, type NextRequest } from 'next/server'
import {
	ALL_INVESTORS_PROTOCOL_IDS,
	getInvestorsProject,
	getInvestorsRootRoute,
	getInvestorsSiteForRequest,
	getInvestorsSiteWithPathFallback
} from '~/containers/Investors/config'
import {
	AB_COOKIE_MAX_AGE_SECONDS,
	AB_GROUP_COOKIE_NAME,
	AB_VISITOR_COOKIE_NAME,
	getABGroup,
	isABVisitorId
} from '~/utils/abTesting'

const ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
const DEFAULT_ALLOWED_HEADERS = 'Content-Type,Authorization,X-Requested-With'
const MAX_AGE_SECONDS = '86400'
const rawAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS ?? ''
const allowedOrigins = new Set(
	rawAllowedOrigins
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean)
)
const allowAnyOrigin = allowedOrigins.has('*')

function appendVaryHeader(response: NextResponse, value: string) {
	const currentValue = response.headers.get('Vary')
	if (!currentValue) {
		response.headers.set('Vary', value)
		return
	}

	const parts = currentValue.split(',').map((part) => part.trim())
	if (!parts.includes(value)) {
		response.headers.set('Vary', `${currentValue}, ${value}`)
	}
}

function resolveAllowedOrigin(origin: string | null, requestOrigin: string): string | null {
	if (allowAnyOrigin) {
		return '*'
	}

	if (!origin) {
		return null
	}

	if (origin === requestOrigin) {
		return origin
	}

	return allowedOrigins.has(origin) ? origin : null
}

function appendPreflightVaryHeaders(response: NextResponse) {
	appendVaryHeader(response, 'Access-Control-Request-Method')
	appendVaryHeader(response, 'Access-Control-Request-Headers')
}

function applyCorsHeaders(
	response: NextResponse,
	request: NextRequest,
	allowedOrigin: string,
	varyByOrigin = !allowAnyOrigin
) {
	response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
	response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS)
	response.headers.set(
		'Access-Control-Allow-Headers',
		request.headers.get('access-control-request-headers') ?? DEFAULT_ALLOWED_HEADERS
	)
	response.headers.set('Access-Control-Max-Age', MAX_AGE_SECONDS)

	if (varyByOrigin) {
		appendVaryHeader(response, 'Origin')
	}
}

function isPublicApiPath(pathname: string) {
	return pathname.startsWith('/api/public/')
}

function isABPageRequest(request: NextRequest) {
	const hostname = request.nextUrl.hostname
	const acceptsHtml = request.headers.get('accept')?.includes('text/html') ?? false
	const isMainSite = hostname === 'defillama.com' || hostname === 'www.defillama.com'
	const isLocalDevelopment =
		process.env.NODE_ENV !== 'production' && (hostname === 'localhost' || hostname === '127.0.0.1')

	return (
		request.method === 'GET' &&
		acceptsHtml &&
		!request.nextUrl.pathname.startsWith('/api/') &&
		(isMainSite || isLocalDevelopment)
	)
}

function applyABAssignment(response: NextResponse, request: NextRequest) {
	if (!isABPageRequest(request)) return

	const currentVisitorId = request.cookies.get(AB_VISITOR_COOKIE_NAME)?.value
	const currentGroup = request.cookies.get(AB_GROUP_COOKIE_NAME)?.value
	const hasValidVisitorId = isABVisitorId(currentVisitorId)
	const visitorId = hasValidVisitorId ? currentVisitorId : crypto.randomUUID()
	const group = getABGroup(visitorId)
	const shouldSetGroup = currentGroup !== group
	const secure = request.nextUrl.protocol === 'https:'

	if (!hasValidVisitorId) {
		response.cookies.set({
			name: AB_VISITOR_COOKIE_NAME,
			value: visitorId,
			httpOnly: true,
			maxAge: AB_COOKIE_MAX_AGE_SECONDS,
			path: '/',
			sameSite: 'lax',
			secure
		})
	}

	if (shouldSetGroup) {
		response.cookies.set({
			name: AB_GROUP_COOKIE_NAME,
			value: group,
			maxAge: AB_COOKIE_MAX_AGE_SECONDS,
			path: '/',
			sameSite: 'lax',
			secure
		})
	}

	if (!hasValidVisitorId || shouldSetGroup) {
		response.headers.set('Cache-Control', 'private, no-store')
	}
}

function getInvestorsPathFallbackRewrite(request: NextRequest) {
	const { pathname } = request.nextUrl
	const segment = pathname.slice(1)
	if (pathname !== '/all' && !ALL_INVESTORS_PROTOCOL_IDS.includes(segment)) return null
	const host = request.headers.get('host')
	const forwardedHost = request.headers.get('x-forwarded-host')
	const site = getInvestorsSiteWithPathFallback(host, forwardedHost, pathname === '/all' ? undefined : segment)
	if (!site) return null
	const destination = request.nextUrl.clone()
	destination.pathname = `/investors/${segment}`
	return destination
}

function getInvestorsRewrite(request: NextRequest) {
	const site = getInvestorsSiteForRequest(request.headers.get('host'), request.headers.get('x-forwarded-host'))
	if (!site) return getInvestorsPathFallbackRewrite(request)

	const { pathname } = request.nextUrl
	const isSingleProject = site.projectIds.length === 1
	const destination = request.nextUrl.clone()

	if (pathname === '/') {
		destination.pathname = getInvestorsRootRoute(site)
		return destination
	}

	if (pathname === '/all') {
		destination.pathname = isSingleProject ? `/investors/${site.defaultProjectId}` : '/investors/all'
		return destination
	}

	const segment = pathname.slice(1)
	if (getInvestorsProject(site, segment)) {
		destination.pathname = `/investors/${segment}`
		return destination
	}

	if (ALL_INVESTORS_PROTOCOL_IDS.includes(segment)) {
		destination.pathname = '/404'
		return destination
	}

	return null
}

export function proxy(request: NextRequest) {
	const investorsRewrite = getInvestorsRewrite(request)
	if (investorsRewrite) {
		return NextResponse.rewrite(investorsRewrite)
	}

	const origin = request.headers.get('origin')
	const isPublicApi = isPublicApiPath(request.nextUrl.pathname)
	const allowedOrigin = isPublicApi ? '*' : resolveAllowedOrigin(origin, request.nextUrl.origin)

	if (!isPublicApi && origin && !allowedOrigin) {
		const response = new NextResponse('CORS origin denied', { status: 403 })
		appendVaryHeader(response, 'Origin')
		if (request.method === 'OPTIONS') {
			appendPreflightVaryHeaders(response)
		}
		return response
	}

	if (request.method === 'OPTIONS') {
		const response = new NextResponse(null, { status: 204 })

		if (allowedOrigin) {
			applyCorsHeaders(response, request, allowedOrigin, !isPublicApi && !allowAnyOrigin)
			appendPreflightVaryHeaders(response)
		}

		return response
	}

	const response = NextResponse.next()

	if (allowedOrigin) {
		applyCorsHeaders(response, request, allowedOrigin, !isPublicApi && !allowAnyOrigin)
	}

	applyABAssignment(response, request)

	return response
}

export const config = {
	matcher: [
		'/api/:path*',
		'/',
		'/all',
		'/etherfi',
		'/spark',
		'/maple',
		'/berachain',
		'/aave',
		'/sonic',
		'/near',
		'/flare',
		'/odyssey-ecosystem',
		'/thorchain',
		'/kpk',
		'/uniswap',
		{
			source: '/((?!api|_next/static|_next/image).*)',
			has: [{ type: 'header', key: 'accept', value: '.*text/html.*' }]
		}
	]
}
