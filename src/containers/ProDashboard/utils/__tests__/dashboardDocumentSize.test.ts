import { expect, test } from 'vitest'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import type { SqlChartConfig, TextConfig } from '../../types'
import {
	DASHBOARD_DATA_LENGTH_LIMIT,
	estimateDashboardDataLength,
	formatDashboardDataLength,
	isDashboardDataTooLarge
} from '../dashboardDocumentSize'

const text: TextConfig = { id: 'text', kind: 'text', content: 'Hello' }

test('measures the serialized data object the way the server does', () => {
	const variables = [{ id: 'chain', kind: 'chain' as const, label: 'Chain', value: 'Ethereum' }]
	const annotations = [{ id: 'a', date: '2026-01-01', label: 'Launch' }]
	const aiUndoState = { items: [text], timestamp: '2026-01-01T00:00:00.000Z', sessionId: 'session' }
	expect(estimateDashboardDataLength({ items: [text], variables, annotations, aiUndoState })).toBe(
		JSON.stringify({ items: [text], variables, annotations, aiUndoState }).length
	)
	expect(estimateDashboardDataLength({ items: [text] })).toBe(JSON.stringify({ items: [text] }).length)
	expect(estimateDashboardDataLength({ items: [text], aiUndoState: null })).toBe(
		JSON.stringify({ items: [text] }).length
	)
})

test('ignores SQL snapshots because they never reach the server', () => {
	const sql: SqlChartConfig = {
		id: 'sql',
		kind: 'sql',
		query: { sql: 'SELECT 1', tableSources: [] },
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
		snapshot: {
			columns: [{ name: 'x', type: 'INTEGER' }],
			rows: Array.from({ length: 5000 }, (_, index) => [index]),
			computedAt: '2026-01-01T00:00:00.000Z',
			rowCount: 5000,
			engine: 'server'
		}
	}
	const { snapshot: _snapshot, ...persisted } = sql
	expect(estimateDashboardDataLength({ items: [sql] })).toBe(JSON.stringify({ items: [persisted] }).length)
})

test('flags documents above the limit and formats the size in kilobytes', () => {
	const rows = Array.from({ length: 12_000 }, (_, index) => [index, `value-${index}`, index * 1.5])
	const large: DashboardItemConfig = {
		id: 'custom',
		kind: 'custom-data',
		name: 'Large',
		columns: [
			{ name: 'id', type: 'BIGINT' },
			{ name: 'label', type: 'VARCHAR' },
			{ name: 'amount', type: 'DOUBLE' }
		],
		rows: [...rows, ...rows, ...rows],
		chart: {
			chartType: 'bar',
			xCol: 'label',
			yCols: ['amount'],
			splitByCol: null,
			stackMode: 'off',
			rightAxisCols: [],
			seriesKinds: {},
			seriesColors: {},
			numberFormat: 'auto'
		},
		displayMode: 'table'
	}
	expect(estimateDashboardDataLength({ items: [large] })).toBeGreaterThan(DASHBOARD_DATA_LENGTH_LIMIT)
	expect(isDashboardDataTooLarge({ items: [large] })).toBe(true)
	expect(isDashboardDataTooLarge({ items: [text] })).toBe(false)
	expect(formatDashboardDataLength(1024 * 900)).toBe('900 KB')
	expect(formatDashboardDataLength(1500)).toBe('1 KB')
})
