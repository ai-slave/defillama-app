import { describe, expect, it } from 'vitest'
import type { DashboardItemConfig, SqlChartConfig } from '../../types'
import { cleanItemsForSaving } from '../dashboardUtils'

const sqlItem: SqlChartConfig = {
	id: 'sql-1',
	kind: 'sql',
	name: 'test',
	query: { sql: 'SELECT 1', tableSources: [{ kind: 'dataset', slug: 'protocols' }] },
	chart: { chartType: 'bar' } as SqlChartConfig['chart'],
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

describe('cleanItemsForSaving sql items', () => {
	it('strips the snapshot but keeps query and render config', () => {
		const [cleaned] = cleanItemsForSaving([sqlItem]) as [SqlChartConfig]
		expect(cleaned.snapshot).toBeUndefined()
		expect(cleaned.query).toEqual(sqlItem.query)
		expect(cleaned.displayMode).toBe('table')
		expect(cleaned.rowCap).toBe(500)
		expect(cleaned.id).toBe('sql-1')
	})

	it('leaves sql items without snapshot untouched', () => {
		const { snapshot: _snapshot, ...noSnapshot } = sqlItem
		const [cleaned] = cleanItemsForSaving([noSnapshot as DashboardItemConfig])
		expect(cleaned).toEqual(noSnapshot)
	})
})
