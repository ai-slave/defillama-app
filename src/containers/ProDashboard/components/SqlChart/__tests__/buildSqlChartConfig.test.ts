import { describe, expect, test } from 'vitest'
import type { ChartConfig } from '~/containers/Downloads/sql/chartConfig'
import type { RegisteredTable } from '~/containers/Downloads/sql/useTableRegistry'
import type { SqlChartConfig } from '../../../types'
import { buildSqlChartConfig } from '../buildSqlChartConfig'

const protocolsTable: RegisteredTable = {
	name: 'protocols',
	source: { kind: 'dataset', slug: 'protocols' },
	columns: [{ name: 'tvl', type: 'DOUBLE' }],
	rowCount: 2,
	loadedAt: 0
}

const chainsTable: RegisteredTable = {
	name: 'chains',
	source: { kind: 'dataset', slug: 'chains' },
	columns: [{ name: 'tvl', type: 'DOUBLE' }],
	rowCount: 2,
	loadedAt: 0
}

const result = {
	columns: [{ name: 'tvl', type: 'DOUBLE' }],
	rows: [[1], [2]]
}

const chartConfig: ChartConfig = {
	chartType: 'bar',
	xCol: null,
	yCols: ['tvl'],
	splitByCol: null,
	stackMode: 'off',
	rightAxisCols: [],
	seriesKinds: {},
	seriesColors: {},
	numberFormat: 'auto'
}

const baseParams = {
	editItem: null,
	name: 'My chart',
	sql: 'SELECT * FROM protocols',
	result,
	ranFresh: true,
	chartConfig,
	displayMode: 'chart' as const,
	rowCap: 1000,
	registryTables: [protocolsTable, chainsTable]
}

const editItem: SqlChartConfig = {
	id: 'sql-existing-1',
	kind: 'sql',
	name: 'Old name',
	query: { sql: 'SELECT 1', tableSources: [{ kind: 'dataset', slug: 'chains' }] },
	chart: chartConfig,
	snapshot: {
		columns: [{ name: 'old', type: 'INTEGER' }],
		rows: [{ old: 1 }],
		computedAt: '2026-01-01T00:00:00.000Z',
		rowCount: 1,
		engine: 'browser'
	},
	colSpan: 2
}

describe('buildSqlChartConfig', () => {
	test('generates a sql-prefixed id for new items and keeps the edited id', () => {
		expect(buildSqlChartConfig(baseParams).id.startsWith('sql-')).toBe(true)
		expect(buildSqlChartConfig({ ...baseParams, editItem }).id).toBe('sql-existing-1')
	})

	test('captures a fresh snapshot and filters tableSources to referenced tables when ranFresh', () => {
		const config = buildSqlChartConfig(baseParams)
		expect(config.snapshot?.rows).toEqual(result.rows)
		expect(config.snapshot?.engine).toBe('browser')
		expect(config.query.tableSources).toEqual([protocolsTable.source])
	})

	test('reuses the edited snapshot and tableSources when not ranFresh', () => {
		const config = buildSqlChartConfig({ ...baseParams, editItem, ranFresh: false })
		expect(config.snapshot).toBe(editItem.snapshot)
		expect(config.query.tableSources).toEqual(editItem.query.tableSources)
	})

	test('captures from the result when not ranFresh and the edited item has no snapshot', () => {
		const config = buildSqlChartConfig({ ...baseParams, editItem: { ...editItem, snapshot: null }, ranFresh: false })
		expect(config.snapshot?.rows).toEqual(result.rows)
	})

	test('persists displayMode and trims sql and name', () => {
		const config = buildSqlChartConfig({
			...baseParams,
			name: '  Padded  ',
			sql: ' SELECT * FROM protocols ',
			displayMode: 'table'
		})
		expect(config.displayMode).toBe('table')
		expect(config.name).toBe('Padded')
		expect(config.query.sql).toBe('SELECT * FROM protocols')
	})

	test('drops empty names and carries colSpan from the edited item', () => {
		expect(buildSqlChartConfig({ ...baseParams, name: '   ' }).name).toBeUndefined()
		expect(buildSqlChartConfig({ ...baseParams, editItem }).colSpan).toBe(2)
	})

	test('truncates the snapshot to a custom row cap and stores it', () => {
		const bigResult = {
			columns: result.columns,
			rows: Array.from({ length: 300 }, (_, i) => [i])
		}
		const config = buildSqlChartConfig({ ...baseParams, result: bigResult, rowCap: 200 })
		expect(config.rowCap).toBe(200)
		expect(config.snapshot?.rows.length).toBe(200)
		expect(config.snapshot?.truncated).toBe(true)
		expect(config.snapshot?.rowCount).toBe(300)
	})

	test('omits rowCap when it equals the default and clamps out-of-range values', () => {
		expect(buildSqlChartConfig(baseParams).rowCap).toBeUndefined()
		expect(buildSqlChartConfig({ ...baseParams, rowCap: 7 }).rowCap).toBe(100)
		expect(buildSqlChartConfig({ ...baseParams, rowCap: 999_999 }).rowCap).toBe(5000)
	})
})
