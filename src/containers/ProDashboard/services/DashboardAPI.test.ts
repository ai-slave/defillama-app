import { describe, expect, it } from 'vitest'
import { buildDashboardSaveRequest, dashboardAPI } from './DashboardAPI'

describe('Dashboard API save contract', () => {
	it('keeps custom periods and explicit undo-state clearing inside dashboard data', () => {
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

	it('migrates fetched config in memory without issuing a persistence request', async () => {
		const urls: string[] = []
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
})
