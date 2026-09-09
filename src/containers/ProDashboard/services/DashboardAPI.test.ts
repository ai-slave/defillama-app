import { describe, expect, test, vi } from 'vitest'
import { buildDashboardSaveRequest, dashboardAPI } from './DashboardAPI'

describe('Dashboard API save contract', () => {
	test('keeps custom periods and explicit undo-state clearing inside dashboard data', () => {
		const request = buildDashboardSaveRequest({
			id: 'dashboard/id',
			data: {
				items: [],
				dashboardName: 'Dashboard',
				timePeriod: 'custom',
				customTimePeriod: { type: 'absolute', startDate: 10, endDate: 20 },
				aiUndoState: null,
				visibility: 'public',
				tags: ['research'],
				description: 'Description'
			}
		})

		expect(request.url).toBe('/api/private/pro-dashboard/save?id=dashboard%2Fid')
		expect(JSON.parse(request.options.body)).toEqual({
			data: {
				items: [],
				dashboardName: 'Dashboard',
				timePeriod: 'custom',
				customTimePeriod: { type: 'absolute', startDate: 10, endDate: 20 },
				aiUndoState: null
			},
			visibility: 'public',
			tags: ['research'],
			description: 'Description',
			aiGenerated: null
		})
	})

	test('migrates fetched config in memory without issuing a persistence request', async () => {
		const urls: Array<string> = []
		const authorizedFetch = async (url: string) => {
			urls.push(url)
			return new Response(
				JSON.stringify({
					id: 'dashboard-1',
					created: '2026-01-01T00:00:00.000Z',
					updated: '2026-01-02T00:00:00.000Z',
					data: {
						dashboardName: 'Dashboard',
						items: [
							{
								id: 'table-1',
								kind: 'unified-table',
								rowHeaders: ['protocol']
							}
						]
					}
				}),
				{ status: 200 }
			)
		}

		const dashboard = await dashboardAPI.getDashboard('slug/with-separator', authorizedFetch)

		expect(dashboard.data.items[0]).toMatchObject({
			kind: 'unified-table',
			configVersion: 3,
			strategy: 'protocols'
		})
		expect(dashboard).not.toHaveProperty('user')
		expect(urls).toHaveLength(1)
		expect(urls[0]).toContain('/dashboards/slug%2Fwith-separator?_=')
	})

	test('normalizes PocketBase timestamps returned by public dashboard search', async () => {
		const authorizedFetch = async () =>
			new Response(
				JSON.stringify({
					items: [
						{
							id: 'public-dashboard',
							created: '2026-08-29 14:47:36.555Z',
							updated: '2026-08-30 15:03:41.147Z',
							editedAt: '2026-08-29 15:14:53.567Z',
							visibility: 'public',
							data: { dashboardName: 'Public Dashboard', items: [] }
						}
					],
					page: 1,
					perPage: 20,
					totalItems: 1,
					totalPages: 1,
					searchParams: {
						query: '',
						tags: [],
						visibility: 'public',
						sortBy: 'trending',
						timeFrame: '7d',
						page: 1,
						limit: 20
					}
				}),
				{ status: 200 }
			)

		const result = await dashboardAPI.searchDashboards(
			{ visibility: 'public', sortBy: 'trending', timeFrame: '7d' },
			authorizedFetch
		)

		expect(result.items[0]).toMatchObject({
			created: '2026-08-29T14:47:36.555Z',
			updated: '2026-08-30T15:03:41.147Z',
			editedAt: '2026-08-29T15:14:53.567Z'
		})
	})
})

test('updates use keepalive within the shared byte budget and release it after failure', async () => {
	const held = Promise.withResolvers<Response>()
	const response = () =>
		new Response(JSON.stringify({ id: 'id', created: '', updated: '', data: { dashboardName: 'Saved', items: [] } }))
	const authorizedFetch = vi
		.fn()
		.mockReturnValueOnce(held.promise)
		.mockImplementation(async () => response())
	const data = {
		dashboardName: 'Saved',
		items: [],
		description: 'a'.repeat(40_000),
		visibility: 'public' as const,
		tags: []
	}
	const first = dashboardAPI.updateDashboard('first', data, authorizedFetch)
	await dashboardAPI.updateDashboard('second', data, authorizedFetch)
	expect(authorizedFetch.mock.calls[0][1].keepalive).toBe(true)
	expect(authorizedFetch.mock.calls[1][1].keepalive).toBe(false)
	held.reject(new Error('Offline'))
	await expect(first).rejects.toThrow('Offline')
	await dashboardAPI.updateDashboard('third', data, authorizedFetch)
	expect(authorizedFetch.mock.calls[2][1].keepalive).toBe(true)
})

test('large UTF-8 update bodies use normal fetch without changing their content', async () => {
	const authorizedFetch = vi.fn(
		async (_url: string, _options?: RequestInit) =>
			new Response(JSON.stringify({ id: 'id', created: '', updated: '', data: { dashboardName: 'Saved', items: [] } }))
	)
	const description = '😀'.repeat(20_000)
	await dashboardAPI.updateDashboard(
		'id',
		{ dashboardName: 'Saved', items: [], description, visibility: 'public', tags: [] },
		authorizedFetch
	)
	const options = authorizedFetch.mock.calls[0][1]!
	expect(options.keepalive).toBe(false)
	expect(JSON.parse(options.body as string).description).toBe(description)
})

test('sends the copy source at the top level of the creation request', () => {
	const request = buildDashboardSaveRequest({
		data: { dashboardName: 'Original', items: [], copySourceDashboardId: 'source' }
	})
	const body = JSON.parse(request.options.body)
	expect(body.copySourceDashboardId).toBe('source')
	expect(body.data).not.toHaveProperty('copySourceDashboardId')
})

test('sends the last-known editedAt at the top level of an update request', () => {
	const data = { dashboardName: 'Dashboard', items: [] }
	const withBase = JSON.parse(buildDashboardSaveRequest({ id: 'id', data, baseEditedAt: 'v1' }).options.body)
	expect(withBase.baseEditedAt).toBe('v1')
	expect(withBase.data).not.toHaveProperty('baseEditedAt')
	const withoutBase = JSON.parse(buildDashboardSaveRequest({ id: 'id', data }).options.body)
	expect(withoutBase).not.toHaveProperty('baseEditedAt')
})

test('a stale update surfaces the conflict as a 409 DashboardError', async () => {
	const authorizedFetch = vi.fn(
		async (_url: string, _options?: RequestInit) =>
			new Response(JSON.stringify({ message: 'Dashboard was modified elsewhere' }), { status: 409 })
	)
	const update = dashboardAPI.updateDashboard('id', { dashboardName: 'Saved', items: [] }, authorizedFetch, 'v1')
	await expect(update).rejects.toMatchObject({ name: 'DashboardError', status: 409 })
	expect(JSON.parse(authorizedFetch.mock.calls[0][1]!.body as string).baseEditedAt).toBe('v1')
})
