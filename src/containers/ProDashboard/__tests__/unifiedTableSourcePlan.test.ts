import { describe, expect, test } from 'vitest'
import type { UnifiedTableConfig } from '../unifiedTable/config/current'
import { buildUnifiedTableStreamSourcePlan } from '../unifiedTableSourcePlan'

function table(id: string, columns: Array<string>, rowHeaders: UnifiedTableConfig['rowHeaders']): UnifiedTableConfig {
	return {
		id,
		kind: 'unified-table',
		configVersion: 3,
		strategy: 'protocols',
		colSpan: 2,
		rowHeaders,
		columnOrder: columns,
		columnVisibility: Object.fromEntries(columns.map((column) => [column, true])),
		defaultSorting: [],
		filters: {}
	}
}

describe('Unified Table stream source plan', () => {
	test('keeps exact table query contracts separate for independent latency and failure boundaries', () => {
		const plan = buildUnifiedTableStreamSourcePlan([
			table('fees', ['name', 'fees24h'], ['protocol']),
			table('volume', ['name', 'volume24h'], ['category', 'protocol'])
		])

		expect(plan).toHaveLength(2)
		expect(plan[0]).toMatchObject({
			baseMetricFamilies: ['fees'],
			pointMetrics: [],
			rowHeaders: [],
			needsOracleMembership: false,
			cacheKey: expect.any(String)
		})
		expect(plan[1]).toMatchObject({ baseMetricFamilies: ['dex-volume'], cacheKey: expect.any(String) })
	})

	test('keeps aggregate and chain-granularity sources separate', () => {
		const plan = buildUnifiedTableStreamSourcePlan([
			table('aggregate', ['name', 'tvl'], ['protocol']),
			table('by-chain', ['name', 'tvl'], ['chain', 'protocol'])
		])

		expect(plan).toHaveLength(2)
		expect(plan.map((source) => source.rowHeaders)).toEqual([[], ['chain']])
	})
})
