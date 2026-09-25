import { describe, expect, test } from 'vitest'
import type { Dashboard } from '../../dashboardTypes'
import type { DashboardAuthorizedFetch } from '../../services/DashboardAPI'
import { addItemToDashboard, moveDashboardItem, replaceDashboardItem } from '../dashboardItemsUtils'

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

	/** The features server: reads return the queued revisions, saves answer with the queued statuses. */
	function server(saveStatuses: Array<number>) {
		const reads = [first, second]
		const saves: Array<{ items: Array<unknown>; baseEditedAt: string }> = []
		const authorizedFetch = (async (url: string, init?: RequestInit) => {
			if (!init) return Response.json(reads.shift())
			const body = JSON.parse(String(init.body))
			saves.push({ items: body.data.items, baseEditedAt: body.baseEditedAt })
			const status = saveStatuses.shift() ?? 200
			if (status !== 200) return Response.json({ message: 'Save failed' }, { status })
			return Response.json({ ...first, data: body.data, editedAt: `after ${body.baseEditedAt}` })
		}) as DashboardAuthorizedFetch
		return { authorizedFetch, saves, reads }
	}

	test('appends to the freshly read items and sends that revision as the conflict baseline', async () => {
		const { authorizedFetch, saves } = server([])
		await addItemToDashboard('dashboard', c, authorizedFetch)
		expect(saves).toEqual([{ items: [a, c], baseEditedAt: 'v1' }])
	})

	test('a conflict re-reads and appends once more against the fresh revision', async () => {
		const { authorizedFetch, saves } = server([409])
		const result = await addItemToDashboard('dashboard', c, authorizedFetch)
		expect(saves).toEqual([
			{ items: [a, c], baseEditedAt: 'v1' },
			{ items: [a, b, c], baseEditedAt: 'v2' }
		])
		expect(result.data.items).toEqual([a, b, c])
	})

	test('a second conflict propagates', async () => {
		const { authorizedFetch, saves } = server([409, 409])
		await expect(addItemToDashboard('dashboard', c, authorizedFetch)).rejects.toMatchObject({ status: 409 })
		expect(saves).toHaveLength(2)
	})

	test('other failures propagate without a re-read', async () => {
		const { authorizedFetch, saves, reads } = server([500])
		await expect(addItemToDashboard('dashboard', c, authorizedFetch)).rejects.toMatchObject({ status: 500 })
		expect(saves).toHaveLength(1)
		expect(reads).toEqual([second])
	})
})
