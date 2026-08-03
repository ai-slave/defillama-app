import type { NextApiRequest, NextApiResponse } from 'next'
import {
	authorizationHeader,
	dashboardIdFromQuery,
	featuresServerUrl,
	fetchExistingDashboard,
	purgeDashboardCache,
	sendBackendResponse
} from '~/server/dashboardPurgeProxy'
import { withApiRouteTelemetry } from '~/utils/telemetry'

export async function dashboardDeleteHandler(req: NextApiRequest, res: NextApiResponse) {
	res.setHeader('Cache-Control', 'private, no-store, max-age=0')

	if (req.method !== 'POST') {
		res.setHeader('Allow', ['POST'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	const id = dashboardIdFromQuery(req)
	if (!id) {
		return res.status(400).json({ error: 'Dashboard id is required' })
	}

	const authHeader = authorizationHeader(req)
	const before = await fetchExistingDashboard(id, authHeader)

	const deleteResponse = await fetch(featuresServerUrl(`/dashboards/delete/${encodeURIComponent(id)}`), {
		method: 'POST',
		headers: authHeader
	})

	if (!deleteResponse.ok) {
		return sendBackendResponse(deleteResponse, res)
	}

	const purgeResult = await purgeDashboardCache({ id: before?.id ?? id, before, after: null })
	if (purgeResult.status !== 'purged') {
		console.error(
			`Dashboard delete cache purge ${purgeResult.status}: ${'reason' in purgeResult ? purgeResult.reason : 'unknown'}`
		)
	}
	res.setHeader('X-Dashboard-Cache-Purge', purgeResult.status)

	return sendBackendResponse(deleteResponse, res)
}

export const dashboardDeleteApiHandler = withApiRouteTelemetry(
	'/api/private/pro-dashboard/delete',
	dashboardDeleteHandler
)
