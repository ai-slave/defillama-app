import { expect, test } from 'vitest'
import { summarizeDashboardItemKinds } from './dashboardItemKindSummary'
test('uses friendly labels, combines tables, and skips missing items', () => {
	expect(summarizeDashboardItemKinds([{ kind: 'chart' }, null, { kind: 'chart' }, { kind: 'unified-table' }])).toBe(
		'2 charts, 1 tables'
	)
	expect(
		summarizeDashboardItemKinds([{ kind: 'chart' }, { kind: 'text' }, { kind: 'sql' }, { kind: 'metric' }])
	).toContain('+1 more')
})
