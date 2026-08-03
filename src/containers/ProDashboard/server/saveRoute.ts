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
import type { PersistedDashboard } from '../dashboardConfig/persisted'

function outboundBody(req: NextApiRequest): string {
	if (typeof req.body === 'string') return req.body
	return JSON.stringify(req.body ?? {})
}

export async function dashboardSaveHandler(req: NextApiRequest, res: NextApiResponse) {
	res.setHeader('Cache-Control', 'private, no-store, max-age=0')

	if (req.method !== 'POST') {
		res.setHeader('Allow', ['POST'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	const id = dashboardIdFromQuery(req)
	const authHeader = authorizationHeader(req)
	const before = id ? await fetchExistingDashboard(id, authHeader) : null

	const saveResponse = await fetch(
		id ? featuresServerUrl(`/dashboards/${encodeURIComponent(id)}`) : featuresServerUrl('/dashboards'),
		{
			method: 'POST',
			headers: { ...authHeader, 'Content-Type': 'application/json' },
			body: outboundBody(req)
		}
	)

	if (!saveResponse.ok) {
		return sendBackendResponse(saveResponse, res)
	}

	let saved: PersistedDashboard
	try {
		saved = await saveResponse.json()
	} catch {
		return res.status(502).json({ error: 'Dashboard save response was not valid JSON' })
	}
	const purgeResult = await purgeDashboardCache({ id: saved.id, before, after: saved })
	if (purgeResult.status !== 'purged') {
		console.error(
			`Dashboard save cache purge ${purgeResult.status}: ${'reason' in purgeResult ? purgeResult.reason : 'unknown'}`
		)
	}
	res.setHeader('X-Dashboard-Cache-Purge', purgeResult.status)

	return res.status(saveResponse.status).json(saved)
}

export const dashboardSaveApiHandler = withApiRouteTelemetry('/api/private/pro-dashboard/save', dashboardSaveHandler)
