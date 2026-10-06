import type { NextApiRequest, NextApiResponse } from 'next'
import { buildProtocolRankingsCsv, type ProtocolRankingExportColumn } from '~/containers/ProtocolRankings/export.server'
import {
	loadPreparedProtocolRankingRows,
	loadProtocolRankingSnapshot,
	resolveProtocolRankingChain
} from '~/containers/ProtocolRankings/server/api'
import { parseStructuredProtocolRankingQuery } from '~/containers/ProtocolRankings/tableQuery'
import { withApiRouteTelemetry } from '~/utils/telemetry'

type ExportBody = {
	chain?: unknown
	query?: unknown
	snapshot?: unknown
	columns?: unknown
}

export const config = {
	api: {
		responseLimit: false
	}
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') {
		res.setHeader('Allow', 'POST')
		res.setHeader('Cache-Control', 'no-store')
		return res.status(405).json({ error: 'Method not allowed' })
	}
	const body = (req.body ?? {}) as ExportBody
	if (typeof body.chain !== 'string' || !body.query || typeof body.query !== 'object' || !Array.isArray(body.columns)) {
		return res.status(400).json({ error: 'Invalid export request' })
	}
	const query = parseStructuredProtocolRankingQuery(body.query)
	if (!query) return res.status(400).json({ error: 'Invalid export query' })
	const chain = resolveProtocolRankingChain(body.chain)
	if (!chain) return res.status(400).json({ error: 'Invalid export chain' })
	const requestedSnapshot = typeof body.snapshot === 'string' ? body.snapshot : null
	const { isContentHashVersion } = await import('~/server/datasetSnapshots/redisBlobStore.server')
	if (requestedSnapshot && !isContentHashVersion(requestedSnapshot)) {
		return res.status(400).json({ error: 'Invalid snapshot token' })
	}
	const { snapshot, mismatch } = await loadProtocolRankingSnapshot(chain, requestedSnapshot)
	if (mismatch) return res.status(409).json({ error: 'snapshot_mismatch', snapshot: snapshot.snapshot })

	const rows = await loadPreparedProtocolRankingRows(chain, snapshot, query)
	const csv = buildProtocolRankingsCsv({ rows, columns: body.columns as Array<ProtocolRankingExportColumn> })
	res.setHeader('Cache-Control', 'no-store')
	res.setHeader('Content-Type', 'text/csv; charset=utf-8')
	res.setHeader('Content-Disposition', `attachment; filename="defillama-${chain.toLowerCase()}-protocols.csv"`)
	return res.status(200).send(csv)
}

export default withApiRouteTelemetry('/api/dynamic/protocol-rankings/export', handler)
