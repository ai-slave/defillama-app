import type { NextApiRequest, NextApiResponse } from 'next'
import { FEATURES_SERVER } from '~/constants'
import type { PersistedDashboard } from '~/containers/ProDashboard/dashboardConfig/persisted'
import { type CloudflarePurgeResult, purgeCloudflareDashboardUrls } from './cloudflarePurge'

export type ProxiedDashboard = { id?: string; slug?: string | null; visibility?: string | null }

export function authorizationHeader(req: NextApiRequest): Record<string, string> {
	const header = req.headers.authorization
	if (Array.isArray(header)) {
		const first = header.find(Boolean)
		return first ? { Authorization: first } : {}
	}
	return header ? { Authorization: header } : {}
}

export function dashboardIdFromQuery(req: NextApiRequest): string | null {
	const { id } = req.query
	if (Array.isArray(id)) return id[0] || null
	return typeof id === 'string' && id ? id : null
}

export async function fetchExistingDashboard(
	id: string,
	authHeader: Record<string, string>
): Promise<ProxiedDashboard | null> {
	try {
		const response = await fetch(`${FEATURES_SERVER}/dashboards/${encodeURIComponent(id)}?_=${Date.now()}`, {
			headers: authHeader
		})
		if (!response.ok) return null
		const dashboard: PersistedDashboard = await response.json()
		return dashboard
	} catch {
		return null
	}
}

export async function sendBackendResponse(response: Response, res: NextApiResponse): Promise<void> {
	try {
		const payload: { message?: string; error?: string } = await response.json()
		res.status(response.status).json(payload)
	} catch {
		res.status(response.status).json({ error: response.statusText || 'Dashboard request failed' })
	}
}

export async function purgeDashboardCache(params: {
	id: string
	before: ProxiedDashboard | null
	after: ProxiedDashboard | null
}): Promise<CloudflarePurgeResult> {
	const afterSlug = params.after?.slug ?? null
	const beforeSlug = params.before?.slug ?? null
	const slug = afterSlug ?? beforeSlug
	const previousSlug = beforeSlug && beforeSlug !== slug ? beforeSlug : null

	try {
		return await purgeCloudflareDashboardUrls({ id: params.id, slug, previousSlug })
	} catch (error) {
		return { reason: error instanceof Error ? error.message : String(error), status: 'failed' }
	}
}
