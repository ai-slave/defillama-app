import { expect, test } from 'vitest'
import type { SqlChartConfig, TextConfig } from '../../types'
import { estimateDashboardDataLength, getDashboardSizeLimitError } from '../dashboardDocumentSize'

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

test('refuses a save only once the dashboard passes 900,000 characters', () => {
	// A text card sized so the whole serialized dashboard is exactly `length` characters long.
	const sized = (length: number): TextConfig => ({
		...text,
		content: 'x'.repeat(length - JSON.stringify({ items: [{ ...text, content: '' }] }).length)
	})

	expect(getDashboardSizeLimitError({ items: [sized(900_000)] })).toBeNull()
	expect(getDashboardSizeLimitError({ items: [sized(900_001)] })).toBe(
		'Dashboard is too large (879 KB). Remove rows or a card.'
	)
})
