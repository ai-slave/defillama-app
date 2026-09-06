import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchCexs } from '~/containers/Cexs/api'
import type { RawCex } from '~/containers/Cexs/api.types'
import { recordRouteRuntimeError, withApiRouteTelemetry } from '~/utils/telemetry'
import { getCexAnalyticsMarketShare, getCexAnalyticsSnapshot, getCexAnalyticsTotals } from './analytics'

export interface CexDatasetRow extends RawCex {
	tvl: number | null
	cleanTvl: number | null
	'24hInflows': number | null
	'7dInflows': number | null
	'1mInflows': number | null
}

async function cexDatasetHandler(_req: NextApiRequest, res: NextApiResponse) {
	try {
		const cexData = await fetchCexs()
		const cexList: Array<CexDatasetRow> = cexData.cexs.map((c) => ({
			...c,
			tvl: c.currentTvl ?? null,
			cleanTvl: c.cleanAssetsTvl ?? null,
			'24hInflows': c.inflows_24h ?? null,
			'7dInflows': c.inflows_1w ?? null,
			'1mInflows': c.inflows_1m ?? null
		}))
		cexList.sort((a, b) => {
			if (a.cleanTvl === b.cleanTvl) return 0
			if (a.cleanTvl === null) return 1
			if (b.cleanTvl === null) return -1
			return b.cleanTvl - a.cleanTvl
		})
		res.status(200).json(cexList)
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute')
		res.status(500).json({ error: 'Failed to fetch cex data' })
	}
}

export const cexDatasetApiHandler = withApiRouteTelemetry('/api/dynamic/cexs', cexDatasetHandler)

type View = 'snapshot' | 'totals' | 'share'

const isView = (value: string | undefined): value is View =>
	value === 'snapshot' || value === 'totals' || value === 'share'

async function cexAnalyticsDatasetHandler(req: NextApiRequest, res: NextApiResponse) {
	try {
		const view = typeof req.query.view === 'string' ? req.query.view : 'snapshot'
		if (!isView(view)) {
			res.status(400).json({ error: 'Invalid cex analytics view' })
			return
		}

		if (view === 'snapshot') {
			res.status(200).json(await getCexAnalyticsSnapshot())
			return
		}

		if (view === 'totals') {
			res.status(200).json(await getCexAnalyticsTotals())
			return
		}

		const metric = req.query.metric === 'spot' ? 'spot' : 'derivatives'
		const requestedTopN = typeof req.query.topN === 'string' ? Number(req.query.topN) : 8
		const topN = Number.isFinite(requestedTopN) ? Math.min(Math.max(Math.trunc(requestedTopN), 1), 12) : 8
		res.status(200).json(await getCexAnalyticsMarketShare(metric, topN))
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute')
		res.status(500).json({ error: 'Failed to fetch cex analytics data' })
	}
}

export const cexAnalyticsDatasetApiHandler = withApiRouteTelemetry(
	'/api/dynamic/cexs/analytics',
	cexAnalyticsDatasetHandler
)
