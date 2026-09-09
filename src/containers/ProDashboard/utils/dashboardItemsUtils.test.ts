import { describe, expect, test } from 'vitest'
import { moveDashboardItem, replaceDashboardItem } from './dashboardItemsUtils'

describe('replaceDashboardItem', () => {
	test('replaces one broken chart while preserving its durable slot identity and layout', () => {
		const items = [
			{ id: 'before', kind: 'text' as const, content: 'before' },
			{
				id: 'repair-slot',
				kind: 'llamaai-chart' as const,
				artifactId: null,
				artifactStatus: 'needs-repair' as const,
				colSpan: 2 as const
			},
			{ id: 'after', kind: 'text' as const, content: 'after' }
		]

		const replaced = replaceDashboardItem(items, 'repair-slot', {
			id: 'generated-id',
			kind: 'llamaai-chart',
			artifactId: 'artifact-new',
			artifactVersionId: 'version-new',
			artifactStatus: 'live',
			title: 'Replacement'
		})

		expect(replaced).toHaveLength(3)
		expect(replaced[1]).toMatchObject({
			id: 'repair-slot',
			colSpan: 2,
			artifactId: 'artifact-new',
			artifactVersionId: 'version-new',
			artifactStatus: 'live',
			title: 'Replacement'
		})
	})

	test('refuses a stale target instead of silently appending a duplicate chart', () => {
		expect(() =>
			replaceDashboardItem([], 'missing', {
				id: 'generated-id',
				kind: 'llamaai-chart',
				artifactId: 'artifact-new',
				artifactStatus: 'live'
			})
		).toThrow('no longer exists')
	})
})

test('moves within the list and preserves boundary references', () => {
	const items = ['a', 'b', 'c'].map((id) => ({ id, kind: 'text' as const, content: id }))
	expect(moveDashboardItem(items, 0, -1)).toBe(items)
	expect(moveDashboardItem(items, 2, 1)).toBe(items)
	expect(moveDashboardItem(items, 1, 1).map((item) => item.id)).toEqual(['a', 'c', 'b'])
})
