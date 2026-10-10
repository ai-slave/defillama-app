import { defineApiRoute } from '~/server/api/types'
import { isContentHashVersion } from '~/server/datasetSnapshots/redisBlobStore.server'
import { TableCursorError } from '~/server/tablePages/cursorPage.server'
import { buildProtocolListCsv } from '../export.server'
import { paginateProtocolListRows } from '../pagination.server'
import { PROTOCOL_LIST_LIMITS, PROTOCOL_LIST_SORT_KEYS, protocolListQuery } from '../tableQuery'
import { getProtocolListSnapshot, prepareProtocolListRows, readProtocolListSnapshot } from './tableData.server'

export const protocolListsApi = defineApiRoute({
	route: '/api/public/protocol-lists',
	methods: ['GET'],
	cacheControl: 'no-store',
	async handle(request) {
		const { kind, snapshot: version, cursor, csv } = request.query
		if (
			(kind !== 'recent' && kind !== 'airdrops') ||
			(version !== undefined && (typeof version !== 'string' || !isContentHashVersion(version))) ||
			(cursor !== undefined && (typeof cursor !== 'string' || cursor.length > 500))
		)
			return { status: 400, body: { error: 'Invalid protocol list request' } }
		const query = protocolListQuery(request.query)
		if (query.sort !== undefined && (typeof query.sort !== 'string' || !PROTOCOL_LIST_SORT_KEYS.includes(query.sort)))
			return { status: 400, body: { error: 'Invalid sort' } }
		let snapshot = typeof version === 'string' ? await readProtocolListSnapshot(kind, version) : null
		if (!snapshot) {
			const latest = await getProtocolListSnapshot(kind)
			if (version && version !== latest.version) {
				if (csv === 'true')
					return { status: 503, body: { error: 'Snapshot unavailable; refresh the table and retry export' } }
				return { status: 409, body: { error: 'snapshot_mismatch', snapshot: latest.version } }
			}
			snapshot = latest
		}
		const { rows, tvlQuickPicks } = await prepareProtocolListRows(snapshot, query)
		if (csv === 'true')
			return {
				status: 200,
				body: buildProtocolListCsv(rows, kind),
				headers: {
					'Content-Type': 'text/csv; charset=utf-8',
					'Content-Disposition': `attachment; filename="${kind}.csv"`
				}
			}
		try {
			return {
				status: 200,
				body: {
					...paginateProtocolListRows(
						rows,
						snapshot.version,
						query,
						typeof cursor === 'string' ? cursor : null,
						PROTOCOL_LIST_LIMITS.page
					),
					tvlQuickPicks,
					chainList: snapshot.chainList,
					categories: snapshot.categories
				}
			}
		} catch (error) {
			if (error instanceof TableCursorError) return { status: 400, body: { error: 'invalid_cursor' } }
			throw error
		}
	}
})
