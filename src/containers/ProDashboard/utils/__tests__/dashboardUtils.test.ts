import { describe, expect, test } from 'vitest'
import type { SqlChartConfig } from '../../types'
import { toPersistedDashboardItems } from '../dashboardUtils'

const sqlItem: SqlChartConfig = {
	id: 'sql-1',
	kind: 'sql',
	name: 'test',
	query: { sql: 'SELECT 1', tableSources: [{ kind: 'dataset', slug: 'protocols' }] },
	chart: {
		chartType: 'bar',
		xCol: null,
		yCols: [],
		splitByCol: null,
		stackMode: 'off',
		rightAxisCols: [],
		seriesKinds: {},
		seriesColors: {},
		numberFormat: 'auto'
	},
	displayMode: 'table',
	rowCap: 500,
	snapshot: {
		columns: [{ name: 'x', type: 'INTEGER' }],
		rows: [{ x: 1 }],
		computedAt: '2026-07-10T00:00:00.000Z',
		rowCount: 1,
		engine: 'server'
	}
}

describe('dashboard item boundary', () => {
	test('strips SQL snapshots but keeps query and render config', () => {
		const [cleaned] = toPersistedDashboardItems([sqlItem])
		if (cleaned?.kind !== 'sql') throw new Error('Expected a SQL dashboard item')
		expect(cleaned.snapshot).toBeUndefined()
		expect(cleaned.query).toEqual(sqlItem.query)
		expect(cleaned.displayMode).toBe('table')
		expect(cleaned.rowCap).toBe(500)
		expect(cleaned.id).toBe('sql-1')
	})

	test('leaves SQL items without snapshots untouched', () => {
		const { snapshot: _snapshot, ...noSnapshot } = sqlItem
		const [cleaned] = toPersistedDashboardItems([noSnapshot])
		expect(cleaned).toEqual(noSnapshot)
	})
})
