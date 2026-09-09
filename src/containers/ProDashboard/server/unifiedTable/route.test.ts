import { describe, expect, test, vi } from 'vitest'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { fetchProtocolsTableMock } = vi.hoisted(() => ({ fetchProtocolsTableMock: vi.fn() }))

vi.mock('./protocols', () => ({ fetchProtocolsTable: fetchProtocolsTableMock }))
vi.mock('~/containers/Oracles/api', () => ({ fetchOracleMetrics: vi.fn() }))
vi.mock('~/utils/telemetry', () => ({
	recordRouteRuntimeError: vi.fn(),
	withApiRouteTelemetry: (_route: string, handler: unknown) => handler
}))

import { PROTOCOL_BASE_METRIC_FAMILIES } from '../../unifiedTable/protocolCapabilities'
import { buildUnifiedTableQueryString } from '../../unifiedTableQuery'
import { parseUnifiedTableQuery, unifiedTableHandler } from './route'

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
		fetchProtocolsTableMock.mockResolvedValueOnce({
			rows: [],
			parentMetrics: {},
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
		const req = createMockNextApiRequest({
			method: 'GET',
			query: { strategy: 'protocols', 'rowHeaders[]': ['protocol', 'chain'], 'chains[]': 'Ethereum' }
		})
		const res = createMockNextApiResponse()

		await unifiedTableHandler(req, res)

		expect(fetchProtocolsTableMock).toHaveBeenCalledWith(
			expect.objectContaining({
				baseMetricFamilies: [...PROTOCOL_BASE_METRIC_FAMILIES],
				needsOracleMembership: true,
				rowMembership: { kind: 'all-protocols' }
			})
		)
		expect(res.setHeader).toHaveBeenCalledWith(
			'Cache-Control',
			'public, max-age=300, s-maxage=300, stale-while-revalidate=60'
		)
		expect(res.json).toHaveBeenCalledWith({
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

test('does not cache invalid requests or source failures', async () => {
	const invalid = createMockNextApiResponse()
	await unifiedTableHandler(createMockNextApiRequest({ method: 'GET', query: { strategy: 'chains' } }), invalid)
	expect(invalid.status).toHaveBeenCalledWith(400)
	expect(invalid.setHeader.mock.calls.some(([name]) => name === 'Cache-Control')).toBe(false)
	fetchProtocolsTableMock.mockRejectedValueOnce(new Error('source unavailable'))
	const failed = createMockNextApiResponse()
	await unifiedTableHandler(createMockNextApiRequest({ method: 'GET', query: { strategy: 'protocols' } }), failed)
	expect(failed.status).toHaveBeenCalledWith(500)
	expect(failed.setHeader.mock.calls.some(([name]) => name === 'Cache-Control')).toBe(false)
})
