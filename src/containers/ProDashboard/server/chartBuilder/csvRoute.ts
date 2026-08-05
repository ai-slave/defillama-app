import type { Writable } from 'node:stream'
import type { NextApiRequest, NextApiResponse } from 'next'
import {
	parseChartBuilderCsvRequest,
	type ChartBuilderCsvRequest
} from '~/containers/ProDashboard/chartBuilderCsvContract'
import { requireSubscription } from '~/server/api/requireSubscription'
import { serializeCsv } from '~/utils/csv'
import { recordRouteRuntimeError, withApiRouteTelemetry } from '~/utils/telemetry'
import { streamAdapterMetricProtocolCsv } from './adapterMetrics/csv'
import { streamChainNativeCsv } from './chainNativeCsv'
import { streamChainTvlCsv } from './chainTvlCsv'
import { buildChartBuilderCsvPayload, getCompleteChartBuilderSeries } from './csvData'
import { streamProtocolTvlCsv } from './protocolTvlCsv'

export const config = { api: { responseLimit: false } }

function authHeader(req: NextApiRequest): string | undefined {
	const value = req.headers.authorization
	return Array.isArray(value) ? value[0] : value
}

function safeFilename(filename: string): string {
	const normalized = filename.replace(/["\r\n;\\/]/g, '_').trim()
	return normalized.toLowerCase().endsWith('.csv') ? normalized : `${normalized}.csv`
}

function usesStreamingSource(request: ChartBuilderCsvRequest): boolean {
	return (
		request.config.metric === 'tvl' ||
		request.config.mode === 'chains' ||
		request.config.metric === 'chain-fees' ||
		request.config.metric === 'chain-revenue'
	)
}

function streamCompleteCsv(request: ChartBuilderCsvRequest, output: Writable): Promise<number> {
	if (request.config.metric === 'chain-fees' || request.config.metric === 'chain-revenue') {
		return streamChainNativeCsv(request, output)
	}
	if (request.config.metric === 'tvl') {
		return request.config.mode === 'chains' ? streamProtocolTvlCsv(request, output) : streamChainTvlCsv(request, output)
	}
	return streamAdapterMetricProtocolCsv(request, output)
}

export async function chartBuilderCsvHandler(req: NextApiRequest, res: NextApiResponse) {
	res.setHeader('Cache-Control', 'private, no-store')
	if (req.method !== 'POST') {
		res.setHeader('Allow', ['POST'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	const auth = await requireSubscription(authHeader(req), res)
	if (!auth) return
	if (auth.isTrial) return res.status(403).json({ error: 'CSV downloads are available only for paid users.' })

	let request
	try {
		request = parseChartBuilderCsvRequest(req.body)
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid CSV request' })
	}

	try {
		const filename = safeFilename(request.filename)
		if (usesStreamingSource(request)) {
			res.status(200)
			res.setHeader('Content-Type', 'text/csv; charset=utf-8')
			res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
			await streamCompleteCsv(request, res)
			return res.end()
		}
		const series = await getCompleteChartBuilderSeries(request)
		if (series.length === 0) return res.status(404).json({ error: 'Chart Builder data is unavailable' })
		const payload = buildChartBuilderCsvPayload(request, series)
		res.setHeader('Content-Type', 'text/csv; charset=utf-8')
		res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
		return res.status(200).send(serializeCsv(payload.rows))
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute', { metric: request.config.metric, mode: request.config.mode })
		if (res.headersSent) {
			res.destroy(error instanceof Error ? error : new Error('Chart Builder CSV stream failed'))
			return
		}
		return res.status(500).json({ error: 'Failed to build Chart Builder CSV' })
	}
}

export const chartBuilderCsvApiHandler = withApiRouteTelemetry(
	'/api/private/pro-dashboard/chart-builder-csv',
	chartBuilderCsvHandler
)
