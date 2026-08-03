import { describe, expect, it, vi } from 'vitest'

vi.mock('~/server/db/llama', () => ({ llamaDb: { any: vi.fn(), one: vi.fn() } }))
vi.mock('~/containers/Oracles/api', () => ({ fetchOracleMetrics: vi.fn() }))

import { buildUnifiedTableQueryString } from '../../unifiedTableQuery'
import { parseUnifiedTableQuery } from './route'

describe('parseUnifiedTableQuery', () => {
	it('accepts, validates, and deduplicates canonical base metric families', () => {
		const parsed = parseUnifiedTableQuery({
			strategy: 'protocols',
			'baseMetricFamilies[]': ['open-interest', 'fees', 'open-interest']
		})

		expect(parsed?.baseMetricFamilies).toEqual(['fees', 'open-interest'])
		expect(parsed?.needsOracleMembership).toBe(false)
	})

	it('parses an explicit oracle membership capability', () => {
		expect(parseUnifiedTableQuery({ strategy: 'protocols', oracleMembership: 'true' })?.needsOracleMembership).toBe(
			true
		)
	})

	it('rejects unknown base metric families', () => {
		expect(
			parseUnifiedTableQuery({ strategy: 'protocols', 'baseMetricFamilies[]': ['open-interest', 'openInterest'] })
		).toBeNull()
	})

	it('parses validated semantic row membership and rejects unknown values', () => {
		expect(
			parseUnifiedTableQuery({ strategy: 'protocols', rowMembership: 'supplemental:earnings' })?.rowMembership
		).toEqual({ kind: 'supplemental-metric', metric: 'earnings' })
		expect(parseUnifiedTableQuery({ strategy: 'protocols', rowMembership: 'preset:anything' })).toBeNull()
	})

	it('round-trips preset membership through the public request contract', () => {
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
})
