import { getProtocolIncomeStatement } from '~/containers/ProtocolOverview/queries'
import { queryString } from '~/server/api/params'
import { badRequest, notFound, okSerializedJson, upstreamError } from '~/server/api/respond'
import { cachedJsonResult } from '~/server/api/resultCache'
import { defineApiRoute } from '~/server/api/types'
import { slug } from '~/utils'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'

// Income statements aggregate several dimension datasets per protocol, so the
// result is memoized and concurrent identical requests share one computation.
const INCOME_STATEMENT_TTL_MS = 10 * 60 * 1000

export const incomeStatement = defineApiRoute({
	route: '/api/public/income-statement',
	cacheControl: 'public, max-age=3600',
	handle: async (req) => {
		const protocol = queryString(req.query, 'protocol')
		if (!protocol) {
			return badRequest('protocol parameter is required')
		}

		try {
			const normalized = slug(protocol)
			const metadataModule = await import('~/utils/metadata')
			const { protocolMetadata } = metadataModule.default
			let metadata: IProtocolMetadata | null = null

			for (const key in protocolMetadata) {
				const record = protocolMetadata[key]
				if (slug(record.displayName) === normalized) {
					metadata = record
					break
				}
			}

			if (!metadata) {
				return notFound('Protocol not found')
			}

			const protocolRecord = metadata
			const data = await cachedJsonResult(
				'income-statement',
				normalized,
				{ ttlMs: INCOME_STATEMENT_TTL_MS, ttlJitter: 0.2 },
				() => getProtocolIncomeStatement({ metadata: protocolRecord })
			)
			return okSerializedJson(data)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch income statement')
		}
	}
})
