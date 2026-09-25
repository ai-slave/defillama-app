import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createLegacyProtocolsUnifiedTableResponse } from '~/containers/ProDashboard/unifiedTable/contracts'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/testing/nextApiMocks'
import { installTelemetrySink } from '~/utils/testing/telemetry'

const { anyMock } = vi.hoisted(() => ({ anyMock: vi.fn() }))
vi.mock('~/server/db/llama', () => ({ llamaDb: { any: anyMock } }))

import { PROTOCOL_BASE_METRIC_FAMILIES } from '../../../unifiedTable/protocolCapabilities'
import { buildUnifiedTableQueryString } from '../../../unifiedTableQuery'
import { parseUnifiedTableQuery, unifiedTableHandler } from '../route'

installTelemetrySink()
beforeEach(() => {
	anyMock.mockReset().mockResolvedValue([])
})

describe('/api/public/pro-dashboard/unified-table/[strategy]', () => {
	const feesQuery = { strategy: 'protocols', 'baseMetricFamilies[]': 'fees' }
	const cacheControl = (res: ReturnType<typeof createMockNextApiResponse>) =>
		res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]

	test('serves a table publicly cached', async () => {
		const res = createMockNextApiResponse()
		await unifiedTableHandler(createMockNextApiRequest({ method: 'GET', query: feesQuery }), res)
		expect(res.statusCode).toBe(200)
		expect(cacheControl(res)).toBe('public, max-age=300, s-maxage=300, stale-while-revalidate=60')
	})

	test('does not cache an invalid request or a source failure', async () => {
		const invalid = createMockNextApiResponse()
		await unifiedTableHandler(createMockNextApiRequest({ method: 'GET', query: { strategy: 'chains' } }), invalid)
		expect(invalid.statusCode).toBe(400)
		expect(cacheControl(invalid)).toBeUndefined()

		anyMock.mockRejectedValue(new Error('source unavailable'))
		const failed = createMockNextApiResponse()
		await unifiedTableHandler(createMockNextApiRequest({ method: 'GET', query: feesQuery }), failed)
		expect(failed.statusCode).toBe(500)
		expect(cacheControl(failed)).toBeUndefined()
	})
})

describe('parseUnifiedTableQuery', () => {
	test('accepts, validates, and deduplicates canonical base metric families', () => {
		const parsed = parseUnifiedTableQuery({
			strategy: 'protocols',
			'baseMetricFamilies[]': ['open-interest', 'fees', 'open-interest']
		})

		expect(parsed?.baseMetricFamilies).toEqual(['fees', 'open-interest'])
		expect(parsed?.needsOracleMembership).toBe(false)
	})

	test('parses an explicit oracle membership capability', () => {
		expect(parseUnifiedTableQuery({ strategy: 'protocols', oracleMembership: 'true' })?.needsOracleMembership).toBe(
			true
		)
	})

	test('restores the full producer contract for requests from pre-capability clients', () => {
		const parsed = parseUnifiedTableQuery({
			strategy: 'protocols',
			'rowHeaders[]': ['protocol', 'chain'],
			'chains[]': 'Ethereum'
		})

		expect(parsed).toMatchObject({
			baseMetricFamilies: [...PROTOCOL_BASE_METRIC_FAMILIES],
			pointMetrics: [],
			supplementalMetrics: [],
			needsOracleMembership: true,
			rowMembership: { kind: 'all-protocols' },
			usesLegacyContract: true
		})
	})

	test('rejects unknown base metric families', () => {
		expect(
			parseUnifiedTableQuery({ strategy: 'protocols', 'baseMetricFamilies[]': ['open-interest', 'openInterest'] })
		).toBeNull()
	})

	test('accepts known point and supplemental metrics and rejects unknown ones', () => {
		expect(parseUnifiedTableQuery({ strategy: 'protocols', 'pointMetrics[]': ['fees'] })?.pointMetrics).toEqual([
			'fees'
		])
		expect(parseUnifiedTableQuery({ strategy: 'protocols', 'pointMetrics[]': ['fees', 'fee'] })).toBeNull()
		expect(
			parseUnifiedTableQuery({ strategy: 'protocols', 'supplementalMetrics[]': ['earnings'] })?.supplementalMetrics
		).toEqual(['earnings'])
		expect(
			parseUnifiedTableQuery({ strategy: 'protocols', 'supplementalMetrics[]': ['bridge-aggregators'] })
		).toBeNull()
	})

	test('parses validated semantic row membership and rejects unknown values', () => {
		expect(
			parseUnifiedTableQuery({ strategy: 'protocols', rowMembership: 'supplemental:earnings' })?.rowMembership
		).toEqual({ kind: 'supplemental-metric', metric: 'earnings' })
		expect(parseUnifiedTableQuery({ strategy: 'protocols', rowMembership: 'preset:anything' })).toBeNull()
	})

	test('round-trips preset membership through the public request contract', () => {
		const query = Object.fromEntries(
			new URLSearchParams(
				buildUnifiedTableQueryString(
					{
						id: 'fees',
						kind: 'unified-table',
						configVersion: 3,
						strategy: 'protocols',
						rowHeaders: ['protocol'],
						activePresetId: 'fees-protocols',
						columnOrder: ['fees24h'],
						columnVisibility: { fees24h: true }
					},
					['protocol']
				)
			)
		)

		expect(parseUnifiedTableQuery({ ...query, strategy: 'protocols' })?.rowMembership).toEqual({
			kind: 'base-metric',
			family: 'fees'
		})
	})

	test('returns legacy chain metrics without the new availability envelope', async () => {
		const result = createLegacyProtocolsUnifiedTableResponse({
			rows: [],
			chainMetrics: {
				ethereum: {
					availability: 'available',
					metrics: {
						bridgedTvl: 1,
						stablesMcap: 2,
						tvlShare: 3,
						stablesShare: 4,
						volume24hShare: 5,
						protocolCount: 6
					}
				}
			}
		})
		expect(result).toEqual({
			rows: [],
			chainMetrics: {
				ethereum: {
					bridgedTvl: 1,
					stablesMcap: 2,
					tvlShare: 3,
					stablesShare: 4,
					volume24hShare: 5,
					protocolCount: 6
				}
			}
		})
	})
})
