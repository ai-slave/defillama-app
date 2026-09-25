import { expect, test } from 'vitest'
import { summarizeDashboardItemKinds } from '../dashboardItemKindSummary'
test('uses friendly labels, combines tables, and skips missing items', () => {
	expect(summarizeDashboardItemKinds([{ kind: 'chart' }, null, { kind: 'chart' }, { kind: 'unified-table' }])).toBe(
		'2 charts, 1 table'
	)
	expect(
		summarizeDashboardItemKinds([{ kind: 'chart' }, { kind: 'text' }, { kind: 'sql' }, { kind: 'metric' }])
	).toContain('+1 more')
})
test('a lone item of a kind reads in the singular while several read in the plural', () => {
	expect(summarizeDashboardItemKinds([{ kind: 'metric' }])).toBe('1 metric')
	expect(summarizeDashboardItemKinds([{ kind: 'dataset-table' }, { kind: 'unified-table' }])).toBe('2 tables')
	expect(summarizeDashboardItemKinds([{ kind: 'income-statement' }, { kind: 'text' }, { kind: 'text' }])).toBe(
		'2 text blocks, 1 income statement'
	)
})
test('sections are not counted while custom datasets get their own label', () => {
	expect(summarizeDashboardItemKinds([{ kind: 'section' }, { kind: 'section' }])).toBe('')
	expect(summarizeDashboardItemKinds([{ kind: 'section' }, { kind: 'chart' }, { kind: 'custom-data' }])).toBe(
		'1 chart, 1 custom dataset'
	)
})
