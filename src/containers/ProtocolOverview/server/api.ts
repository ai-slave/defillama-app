import type { IncomeStatementMetric } from '~/containers/ProtocolOverview/api.types'
import { getProtocolIncomeStatement } from '~/containers/ProtocolOverview/queries'
import type { IProtocolOverviewPageData } from '~/containers/ProtocolOverview/types'
import { queryString } from '~/server/api/params'
import { badRequest, notFound, okSerializedJson, upstreamError } from '~/server/api/respond'
import { cachedJsonResult, cachedResult } from '~/server/api/resultCache'
import { defineApiRoute } from '~/server/api/types'
import { slug } from '~/utils'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'

// Income statements aggregate several dimension datasets per protocol, so the
// result is memoized and concurrent identical requests share one computation.
const INCOME_STATEMENT_TTL_MS = 10 * 60 * 1000
const INCOME_STATEMENT_CACHE_OPTIONS = { ttlMs: INCOME_STATEMENT_TTL_MS, ttlJitter: 0.2 } as const

type NormalizedIncomeStatement = NonNullable<IProtocolOverviewPageData['incomeStatement']>
type LegacyIncomeStatementPeriod = Record<string, number | IncomeStatementMetric>
type LegacyIncomeStatement = Omit<NormalizedIncomeStatement, 'data'> & {
	data: Record<'monthly' | 'quarterly' | 'yearly' | 'cumulative', Record<string, LegacyIncomeStatementPeriod>>
}

function toLegacyIncomeStatement(data: NormalizedIncomeStatement | null): LegacyIncomeStatement | null {
	if (data === null) return null

	const flattenPeriods = (
		periods: NormalizedIncomeStatement['data']['monthly'],
		includeEmptyBreakdowns: boolean
	): Record<string, LegacyIncomeStatementPeriod> => {
		const flattened: Record<string, LegacyIncomeStatementPeriod> = {}
		for (const period in periods) {
			const source = periods[period]
			if (!source) continue
			const metrics: Record<string, IncomeStatementMetric> = {}
			for (const label in source.values) {
				const metric = source.values[label]
				if (!metric) continue
				metrics[label] =
					includeEmptyBreakdowns && metric['by-label'] === undefined ? { ...metric, 'by-label': {} } : metric
			}
			flattened[period] = { ...metrics, timestamp: source.timestamp }
		}
		return flattened
	}

	return {
		...data,
		data: {
			monthly: flattenPeriods(data.data.monthly, false),
			quarterly: flattenPeriods(data.data.quarterly, false),
			yearly: flattenPeriods(data.data.yearly, false),
			cumulative: flattenPeriods(data.data.cumulative, true)
		}
	}
}

export const incomeStatement = defineApiRoute({
	route: '/api/public/income-statement',
	cacheControl: 'public, max-age=3600',
	handle: async (req) => {
		const protocol = queryString(req.query, 'protocol')
		if (!protocol) {
			return badRequest('protocol parameter is required')
		}
		const requestedVersion = queryString(req.query, 'version')
		if (requestedVersion !== undefined && requestedVersion !== '2') {
			return badRequest(`Invalid version: ${requestedVersion}`)
		}

		try {
			const normalized = slug(protocol)
			const metadataModule = await import('~/utils/metadata')
			const { protocolMetadata } = metadataModule.default
			let metadata: IProtocolMetadata | null = null

			for (const key in protocolMetadata) {
				const record = protocolMetadata[key]
				if (!record) continue
				if (slug(record.displayName) === normalized) {
					metadata = record
					break
				}
			}

			if (!metadata) {
				return notFound('Protocol not found')
			}

			const protocolRecord = metadata
			const responseVersion = requestedVersion === '2' ? 'v2' : 'legacy'
			const data = await cachedJsonResult(
				'income-statement-response',
				`${responseVersion}:${normalized}`,
				INCOME_STATEMENT_CACHE_OPTIONS,
				async () => {
					const normalizedData = await cachedResult(
						'income-statement-normalized',
						normalized,
						INCOME_STATEMENT_CACHE_OPTIONS,
						() => getProtocolIncomeStatement({ metadata: protocolRecord })
					)
					return responseVersion === 'v2' ? normalizedData : toLegacyIncomeStatement(normalizedData)
				}
			)
			return okSerializedJson(data)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch income statement')
		}
	}
})
