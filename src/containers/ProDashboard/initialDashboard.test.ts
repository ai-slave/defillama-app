import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { initDashboardState } from './dashboardReducer'
import type { Dashboard } from './dashboardTypes'
import {
	hydrateDashboardInitialRenderPayload,
	isDashboardInitialRenderHydration,
	toOwnerDashboardInitialRenderPayload,
	toPublicDashboardInitialRenderPayload
} from './initialDashboard'
import type { ChartConfig, DashboardItemConfig } from './types'
import { buildDashboardSeo } from './utils/seo'

function dashboard(items: DashboardItemConfig[]): Dashboard {
	return {
		id: 'dashboard-1',
		slug: 'public-dashboard',
		user: 'owner-1',
		visibility: 'public',
		tags: ['fees'],
		description: 'Dashboard description',
		created: '2026-01-01T00:00:00.000Z',
		updated: '2026-01-02T00:00:00.000Z',
		collectionId: 'internal-collection',
		collectionName: 'dashboards',
		aiGenerated: {
			private: {
				mode: 'create',
				prompt: 'private prompt',
				rated: false,
				timestamp: '2026-01-01T00:00:00.000Z',
				userId: 'owner-1'
			}
		},
		data: {
			dashboardName: 'Public Dashboard',
			timePeriod: '365d',
			aiUndoState: { items: [], timestamp: '2026-01-01T00:00:00.000Z', sessionId: 'private' },
			items
		}
	}
}

describe('dashboard initial render payload', () => {
	it('keeps public render config while excluding ownership, AI history, and source data', () => {
		const chart: ChartConfig = {
			id: 'chart-1',
			kind: 'chart',
			chain: 'Ethereum',
			type: 'fees',
			data: [[1_700_000_000, 42]],
			isLoading: false,
			hasError: false,
			refetch: () => {}
		}
		const payload = toPublicDashboardInitialRenderPayload(
			dashboard([
				chart,
				{
					id: 'ai-1',
					kind: 'llamaai-chart',
					title: 'AI chart',
					inlineChartConfig: {
						id: 'ai-config-1',
						type: 'line',
						title: 'AI chart',
						description: 'AI chart description',
						axes: {
							x: { field: 'timestamp', label: 'Date', type: 'time' },
							yAxes: [{ id: 'value', fields: ['value'], label: 'Value', position: 'left' }]
						},
						series: [
							{
								name: 'Value',
								type: 'line',
								yAxisId: 'value',
								metricClass: 'stock',
								dataMapping: { xField: 'timestamp', yField: 'value' },
								styling: {}
							}
						],
						dataTransformation: { timeField: 'timestamp', metrics: ['value'] }
					},
					inlineChartData: { series: [{ timestamp: 1_700_000_000, value: 1 }] }
				}
			])
		)

		expect(payload.data.items[0]).toEqual({
			id: 'chart-1',
			kind: 'chart',
			chain: 'Ethereum',
			type: 'fees'
		})
		expect(payload.data.items[1]).not.toHaveProperty('inlineChartData')
		expect(payload.data).not.toHaveProperty('aiUndoState')
		expect(payload).not.toHaveProperty('ownerId')
		expect(payload).not.toHaveProperty('aiGenerated')
		expect(payload).not.toHaveProperty('collectionId')
		expect(payload).not.toHaveProperty('collectionName')
	})

	it('includes verified owner identity for edit hydration without editor history', () => {
		const payload = toOwnerDashboardInitialRenderPayload(dashboard([]))

		expect(payload.ownerId).toBe('owner-1')
		expect(payload).not.toHaveProperty('aiGenerated')
		expect(payload.data).not.toHaveProperty('aiUndoState')
		expect(hydrateDashboardInitialRenderPayload(payload)).toEqual(
			expect.objectContaining({ id: 'dashboard-1', user: 'owner-1', visibility: 'public' })
		)
	})

	it('makes dashboard shell config available synchronously before stream data arrives', () => {
		const payload = toPublicDashboardInitialRenderPayload(
			dashboard([{ id: 'text-1', kind: 'text', title: 'Summary', content: 'Ready on first render' }])
		)
		const state = initDashboardState({ dashboard: hydrateDashboardInitialRenderPayload(payload) })

		expect(state.dashboardName).toBe('Public Dashboard')
		expect(state.items).toEqual(payload.data.items)
		expect(state.currentDashboard?.id).toBe('dashboard-1')
	})

	it('marks recreated initial render dashboards as untrusted without marking API records', () => {
		const source = dashboard([])
		const payload = toOwnerDashboardInitialRenderPayload(source)
		const firstHydration = hydrateDashboardInitialRenderPayload(payload)
		const recreatedHydration = hydrateDashboardInitialRenderPayload(payload)

		expect(isDashboardInitialRenderHydration(firstHydration)).toBe(true)
		expect(isDashboardInitialRenderHydration(recreatedHydration)).toBe(true)
		expect(isDashboardInitialRenderHydration(source)).toBe(false)
	})

	it('preserves an existing trusted query cache entry when initial render data is provided', () => {
		const queryClient = new QueryClient()
		const queryKey = ['pro-dashboard', 'dashboard', 'dashboard-1', true, 'owner-1'] as const
		const trustedDashboard = dashboard([])
		const initialDashboard = hydrateDashboardInitialRenderPayload(
			toOwnerDashboardInitialRenderPayload(trustedDashboard)
		)
		queryClient.setQueryData(queryKey, trustedDashboard)

		const observer = new QueryObserver(queryClient, {
			queryKey,
			queryFn: async () => trustedDashboard,
			enabled: false,
			initialData: initialDashboard
		})

		expect(observer.getCurrentResult().data).toBe(trustedDashboard)
		expect(observer.getCurrentResult().data).not.toBe(initialDashboard)
		queryClient.clear()
	})

	it('keeps a representative 24-item __NEXT_DATA__ config payload bounded', () => {
		const items: DashboardItemConfig[] = Array.from({ length: 24 }, (_, index) => ({
			id: `builder-${index}`,
			kind: 'builder',
			name: `Protocol revenue comparison ${index}`,
			config: {
				metric: 'protocol-revenue',
				mode: 'protocol',
				filterMode: 'include',
				chainFilterMode: 'include',
				categoryFilterMode: 'include',
				chains: ['Ethereum', 'Arbitrum', 'Base'],
				chainCategories: ['EVM'],
				protocolCategories: ['Lending', 'Dexes'],
				categories: ['Lending', 'Dexes'],
				groupBy: 'protocol',
				limit: 10,
				chartType: 'stackedArea',
				displayAs: 'timeSeries',
				hideOthers: false,
				groupByParent: true
			}
		}))
		const source = dashboard(items)
		const payload = toPublicDashboardInitialRenderPayload(source)
		const nextDataBytes = Buffer.byteLength(
			JSON.stringify({
				props: {
					pageProps: {
						dashboardId: payload.slug,
						initialDashboard: payload,
						seo: buildDashboardSeo(source),
						noIndex: false,
						status: 200
					}
				}
			})
		)

		expect(nextDataBytes).toBeLessThan(30_000)
	})
})
