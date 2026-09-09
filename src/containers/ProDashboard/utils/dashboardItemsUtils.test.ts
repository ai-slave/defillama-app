import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Dashboard } from '../dashboardTypes'
import { DashboardError } from '../services/DashboardAPI'
import { addItemToDashboard, moveDashboardItem, replaceDashboardItem } from './dashboardItemsUtils'

const api = vi.hoisted(() => ({ update: vi.fn(), get: vi.fn() }))
vi.mock('../services/DashboardAPI', async (original) => ({
	...(await original<typeof import('../services/DashboardAPI')>()),
	dashboardAPI: { updateDashboard: api.update, getDashboard: api.get }
}))

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

describe('addItemToDashboard', () => {
	const a = { id: 'a', kind: 'text' as const, content: 'A' }
	const b = { id: 'b', kind: 'text' as const, content: 'B' }
	const c = { id: 'c', kind: 'text' as const, content: 'C' }
	const first: Dashboard = {
		id: 'dashboard',
		user: 'owner',
		data: { dashboardName: 'Dashboard', items: [a] },
		created: '',
		updated: '',
		editedAt: 'v1'
	}
	const second: Dashboard = { ...first, data: { ...first.data, items: [a, b] }, editedAt: 'v2' }
	const conflict = () => new DashboardError('Dashboard was modified elsewhere', 409)
	const authorizedFetch = vi.fn()

	beforeEach(() => {
		api.update.mockReset().mockImplementation(async (id, data, _fetch, baseEditedAt) => ({
			...first,
			id,
			data,
			editedAt: `after ${baseEditedAt}`
		}))
		api.get.mockReset().mockResolvedValueOnce(first).mockResolvedValueOnce(second)
	})

	test('appends to the freshly read items and sends that revision as the conflict baseline', async () => {
		await addItemToDashboard('dashboard', c, authorizedFetch)
		expect(api.update).toHaveBeenCalledOnce()
		expect(api.update.mock.calls[0][1].items).toEqual([a, c])
		expect(api.update.mock.calls[0][3]).toBe('v1')
	})

	test('a conflict re-reads and appends once more against the fresh revision', async () => {
		api.update.mockRejectedValueOnce(conflict())
		const result = await addItemToDashboard('dashboard', c, authorizedFetch)
		expect(api.get).toHaveBeenCalledTimes(2)
		expect(api.update).toHaveBeenCalledTimes(2)
		expect(api.update.mock.calls[1][1].items).toEqual([a, b, c])
		expect(api.update.mock.calls[1][3]).toBe('v2')
		expect(result.data.items).toEqual([a, b, c])
	})

	test('a second conflict propagates', async () => {
		api.update.mockRejectedValueOnce(conflict()).mockRejectedValueOnce(conflict())
		await expect(addItemToDashboard('dashboard', c, authorizedFetch)).rejects.toMatchObject({ status: 409 })
		expect(api.update).toHaveBeenCalledTimes(2)
	})

	test('other failures propagate without a re-read', async () => {
		api.update.mockRejectedValueOnce(new DashboardError('Server error', 500))
		await expect(addItemToDashboard('dashboard', c, authorizedFetch)).rejects.toMatchObject({ status: 500 })
		expect(api.get).toHaveBeenCalledOnce()
		expect(api.update).toHaveBeenCalledOnce()
	})
})
