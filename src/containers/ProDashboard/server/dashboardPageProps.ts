import type { GetServerSideProps, GetServerSidePropsContext, GetServerSidePropsResult } from 'next'
import {
	type DashboardInitialRenderPayload,
	toOwnerDashboardInitialRenderPayload,
	toPublicDashboardInitialRenderPayload
} from '../initialDashboard'
import { fetchDashboardConfig, fetchDashboardConfigWithStatus } from '../queries.server'
import { buildDashboardSeo, type DashboardSeo } from '../utils/seo'
import { fetchAuthenticatedUserId, getAuthTokenFromRequest } from './auth'

const SITE_ORIGIN = 'https://defillama.com'
const PUBLIC_DASHBOARD_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=60'
const PRIVATE_DASHBOARD_CACHE_CONTROL = 'private, no-cache, no-store, must-revalidate'

export type DashboardPageMode = 'view' | 'edit'

export type DashboardPageProps = {
	dashboardId: string
	mode: DashboardPageMode
	initialDashboard: DashboardInitialRenderPayload | null
	seo: DashboardSeo | null
	ogImage: string | null
	noIndex: boolean
	status: number
}

function withResolvedQuery(destination: string, resolvedUrl: string): string {
	const queryIndex = resolvedUrl.indexOf('?')
	return queryIndex === -1 ? destination : `${destination}${resolvedUrl.slice(queryIndex)}`
}

function noIndexProps(dashboardId: string, mode: DashboardPageMode, status: number): DashboardPageProps {
	return {
		dashboardId,
		mode,
		initialDashboard: null,
		seo: null,
		ogImage: null,
		noIndex: true,
		status
	}
}

async function getViewServerSideProps(
	context: GetServerSidePropsContext,
	dashboardId: string
): Promise<GetServerSidePropsResult<DashboardPageProps>> {
	const authToken = getAuthTokenFromRequest(context.req)
	const isAuthenticatedRequest = !!authToken

	if (dashboardId === 'new') {
		context.res.setHeader('Cache-Control', 'private, no-store')
		if (isAuthenticatedRequest) {
			context.res.setHeader('Vary', 'Cookie, Authorization')
		}
		return { props: noIndexProps(dashboardId, 'view', 200) }
	}

	context.res.setHeader('Vary', 'Cookie, Authorization')
	if (isAuthenticatedRequest) {
		context.res.setHeader('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
	}

	let { dashboard, status } = await fetchDashboardConfigWithStatus(dashboardId, authToken)
	if (!dashboard && isAuthenticatedRequest) {
		;({ dashboard, status } = await fetchDashboardConfigWithStatus(dashboardId, null))
	}

	if (dashboard?.slug && dashboard.slug !== dashboardId) {
		return {
			redirect: {
				destination: withResolvedQuery(`/pro/${encodeURIComponent(dashboard.slug)}`, context.resolvedUrl),
				permanent: true
			}
		}
	}

	if (dashboard?.visibility === 'public') {
		if (!isAuthenticatedRequest) {
			context.res.setHeader('Cache-Control', PUBLIC_DASHBOARD_CACHE_CONTROL)
		}
		const seo = buildDashboardSeo(dashboard)
		return {
			props: {
				dashboardId,
				mode: 'view',
				initialDashboard: toPublicDashboardInitialRenderPayload(dashboard),
				seo,
				ogImage: `${SITE_ORIGIN}/api/og/pro/${encodeURIComponent(dashboard.slug || dashboard.id)}`,
				noIndex: false,
				status: 200
			}
		}
	}

	if (isAuthenticatedRequest) {
		if (dashboard) {
			return {
				props: {
					dashboardId,
					mode: 'view',
					initialDashboard: toOwnerDashboardInitialRenderPayload(dashboard),
					seo: null,
					ogImage: null,
					noIndex: true,
					status: 200
				}
			}
		}
		return { props: noIndexProps(dashboardId, 'view', 200) }
	}

	const responseStatus = status === 404 ? 404 : status === 401 || status === 403 ? status : 500
	context.res.statusCode = responseStatus
	context.res.setHeader('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
	return { props: noIndexProps(dashboardId, 'view', responseStatus) }
}

async function getEditServerSideProps(
	context: GetServerSidePropsContext,
	dashboardId: string
): Promise<GetServerSidePropsResult<DashboardPageProps>> {
	context.res.setHeader('Cache-Control', 'private, no-store')

	const authToken = getAuthTokenFromRequest(context.req)
	if (!authToken) {
		context.res.statusCode = 401
		return { props: noIndexProps(dashboardId, 'edit', 401) }
	}

	try {
		const [dashboard, authenticatedUserId] = await Promise.all([
			fetchDashboardConfig(dashboardId, authToken),
			fetchAuthenticatedUserId(authToken)
		])
		if (!dashboard) {
			return { notFound: true }
		}
		if (dashboard.slug && dashboard.slug !== dashboardId) {
			return {
				redirect: {
					destination: withResolvedQuery(`/pro/${encodeURIComponent(dashboard.slug)}/edit`, context.resolvedUrl),
					permanent: true
				}
			}
		}
		return {
			props: {
				...noIndexProps(dashboardId, 'edit', 200),
				initialDashboard:
					authenticatedUserId === dashboard.user ? toOwnerDashboardInitialRenderPayload(dashboard) : null
			}
		}
	} catch {
		// Fall through; client will surface error
	}

	return { props: noIndexProps(dashboardId, 'edit', 200) }
}

export const getDashboardPageProps: GetServerSideProps<DashboardPageProps> = async (context) => {
	const dashboardId = context.params?.dashboardId as string
	const modeSegments = context.params?.mode
	const segments = Array.isArray(modeSegments) ? modeSegments : modeSegments ? [modeSegments] : []

	if (segments.length === 0) {
		return getViewServerSideProps(context, dashboardId)
	}
	if (segments.length > 1 || segments[0] !== 'edit') {
		return { notFound: true }
	}
	return getEditServerSideProps(context, dashboardId)
}
