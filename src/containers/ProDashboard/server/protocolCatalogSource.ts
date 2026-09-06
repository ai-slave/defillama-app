import type { NextApiRequest, NextApiResponse } from 'next'
import type { ProProtocolCatalogSourceRow } from '~/containers/ProDashboard/protocolCatalog'
import { recordRouteRuntimeError, withApiRouteTelemetry } from '~/utils/telemetry'

interface LensProtocolCatalogRow {
	slug: string
	name: string
	protocol: string
	category: string | null
	tvl_base: number | null
	symbol: string | null
	token_nk: string | null
	has_misrepresented_tokens: boolean
	exclude_tvl_from_parent: boolean
}

export async function fetchProProtocolCatalogSourceRows(): Promise<Array<ProProtocolCatalogSourceRow>> {
	const { llamaDb } = await import('~/server/db/llama')
	const rows = await llamaDb.query<Array<LensProtocolCatalogRow>>(`
		SELECT
			p.slug,
			p.name,
			p.protocol,
			p.category,
			metrics.tvl_base,
			token.symbol,
			token.token_nk,
			p.has_misrepresented_tokens,
			p.exclude_tvl_from_parent
		FROM lens.metrics_sub_protocol_current metrics
		JOIN dim.protocol p ON p.slug = metrics.sub_protocol
		LEFT JOIN dim.token token ON token.token_sk = p.canonical_token_sk
		ORDER BY p.slug
	`)
	return rows.map((row) => ({
		slug: row.slug,
		name: row.name,
		parentSlug: row.protocol,
		category: row.category,
		tvl: row.tvl_base,
		symbol: row.symbol,
		geckoId: row.token_nk?.startsWith('coingecko:') ? row.token_nk.slice('coingecko:'.length) : null,
		hasMisrepresentedTokens: row.has_misrepresented_tokens,
		excludeTvlFromParent: row.exclude_tvl_from_parent
	}))
}

type ProtocolCatalogSourceResponse = Array<ProProtocolCatalogSourceRow> | { error: string }

export async function protocolCatalogSourceHandler(
	req: NextApiRequest,
	res: NextApiResponse<ProtocolCatalogSourceResponse>
) {
	if (req.method !== 'GET') {
		res.setHeader('Allow', ['GET'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}
	try {
		const rows = await fetchProProtocolCatalogSourceRows()
		res.setHeader('Cache-Control', 'public, max-age=300')
		return res.status(200).json(rows)
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute')
		return res.status(500).json({ error: 'Failed to load Pro protocol catalog source' })
	}
}

export const protocolCatalogSourceApiHandler = withApiRouteTelemetry(
	'/api/dynamic/pro-dashboard/protocol-catalog-source',
	protocolCatalogSourceHandler
)
