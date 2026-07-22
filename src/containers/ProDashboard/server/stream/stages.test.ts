import { describe, expect, it } from 'vitest'
import type { DashboardItemConfig } from '../../types'
import { INITIAL_DASHBOARD_STREAM_ITEM_COUNT, partitionDashboardStreamItems } from './stages'

describe('partitionDashboardStreamItems', () => {
	it('keeps the first visible rows ordered ahead of deferred dashboard items', () => {
		const items: DashboardItemConfig[] = Array.from({ length: 24 }, (_, index) => ({
			id: `text-${index}`,
			kind: 'text',
			content: `Item ${index}`
		}))

		const stages = partitionDashboardStreamItems(items)

		expect(stages).toHaveLength(2)
		expect(stages[0].map((item) => item.id)).toEqual(
			items.slice(0, INITIAL_DASHBOARD_STREAM_ITEM_COUNT).map((item) => item.id)
		)
		expect(stages[1].map((item) => item.id)).toEqual(
			items.slice(INITIAL_DASHBOARD_STREAM_ITEM_COUNT).map((item) => item.id)
		)
	})

	it('uses one stage for a dashboard that already fits the initial window', () => {
		const items: DashboardItemConfig[] = [{ id: 'text-1', kind: 'text', content: 'Summary' }]

		expect(partitionDashboardStreamItems(items)).toEqual([items])
	})
})
