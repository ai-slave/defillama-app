import { describe, expect, test } from 'vitest'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { initDashboardState } from '../dashboardReducer'
import type { Dashboard } from '../dashboardTypes'
import {
	hydrateDashboardInitialRenderPayload,
	isDashboardInitialRenderHydration,
	toOwnerDashboardInitialRenderPayload,
	toPublicDashboardInitialRenderPayload,
	toPublicDashboardResponse
} from '../initialDashboard'
import type { ChartConfig } from '../types'
import { buildDashboardSeo } from '../utils/seo'

function dashboard(items: Array<DashboardItemConfig>): Dashboard {
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
			aiUndoState: {
				items: [],
				timestamp: '2026-01-01T00:00:00.000Z',
				sessionId: 'private'
			},
			items
		}
	}
}

describe('dashboard initial render payload', () => {
	test('keeps public render config while excluding ownership, AI history, and source data', () => {
		const chart: ChartConfig = {
			id: 'chart-1',
			kind: 'chart',
			subjectType: 'chain',
			chain: 'Ethereum',
			type: 'fees'
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
							yAxes: [
								{
									id: 'value',
									fields: ['value'],
									label: 'Value',
									position: 'left'
								}
							]
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
			subjectType: 'chain',
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

	test('includes verified owner identity for edit hydration without editor history', () => {
		const payload = toOwnerDashboardInitialRenderPayload(dashboard([]))

		expect(payload.ownerId).toBe('owner-1')
		expect(payload).not.toHaveProperty('aiGenerated')
		expect(payload.data).not.toHaveProperty('aiUndoState')
		expect(hydrateDashboardInitialRenderPayload(payload)).toEqual(
			expect.objectContaining({
				id: 'dashboard-1',
				user: 'owner-1',
				visibility: 'public'
			})
		)
	})

	test('makes dashboard shell config available synchronously before stream data arrives', () => {
		const payload = toPublicDashboardInitialRenderPayload(
			dashboard([
				{
					id: 'text-1',
					kind: 'text',
					title: 'Summary',
					content: 'Ready on first render'
				}
			])
		)
		const state = initDashboardState({
			dashboard: hydrateDashboardInitialRenderPayload(payload)
		})

		expect(state.dashboardName).toBe('Public Dashboard')
		expect(state.items).toEqual(payload.data.items)
		expect(state.currentDashboard?.id).toBe('dashboard-1')
	})

	test('marks recreated initial render dashboards as untrusted without marking API records', () => {
		const source = dashboard([])
		const payload = toOwnerDashboardInitialRenderPayload(source)
		const firstHydration = hydrateDashboardInitialRenderPayload(payload)
		const recreatedHydration = hydrateDashboardInitialRenderPayload(payload)

		expect(isDashboardInitialRenderHydration(firstHydration)).toBe(true)
		expect(isDashboardInitialRenderHydration(recreatedHydration)).toBe(true)
		expect(isDashboardInitialRenderHydration(source)).toBe(false)
	})

	test('keeps a representative 24-item __NEXT_DATA__ config payload bounded', () => {
		const items: Array<DashboardItemConfig> = Array.from({ length: 24 }, (_, index) => ({
			id: `builder-${index}`,
			kind: 'builder',
			name: `Protocol revenue comparison ${index}`,
			config: {
				metric: 'protocol-revenue',
				mode: 'protocol',
				chainFilterMode: 'include',
				categoryFilterMode: 'include',
				chainCategoryFilterMode: 'include',
				protocolCategoryFilterMode: 'include',
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

test('preserves public fork attribution through SSR hydration', () => {
	const copiedFrom = { id: 'source', slug: 'original', name: 'Original' }
	const source = { ...dashboard([]), copiedFrom }
	for (const payload of [toPublicDashboardInitialRenderPayload(source), toOwnerDashboardInitialRenderPayload(source)]) {
		expect(hydrateDashboardInitialRenderPayload(payload).copiedFrom).toEqual(copiedFrom)
	}
})

describe('dashboard initial render payload with document-level fields and custom data', () => {
	const variables = [{ id: 'chain', kind: 'chain' as const, label: 'Chain', value: 'Ethereum' }]
	const annotations = [{ id: 'merge', date: '2026-03-01', label: 'Merge' }]
	const customData: DashboardItemConfig = {
		id: 'custom-1',
		kind: 'custom-data',
		name: 'Treasury',
		columns: [
			{ name: 'date', type: 'date' },
			{ name: 'value', type: 'number' }
		],
		rows: [
			['2026-01-01', 1],
			['2026-01-02', 2]
		],
		chart: {
			chartType: 'line',
			xCol: 'date',
			yCols: ['value'],
			splitByCol: null,
			stackMode: 'off',
			rightAxisCols: [],
			seriesKinds: {},
			seriesColors: {},
			numberFormat: 'auto'
		},
		displayMode: 'chart',
		height: 'tall'
	}
	const source: Dashboard = {
		...dashboard([customData, { id: 'text-1', kind: 'text', content: 'Notes' }]),
		data: {
			...dashboard([]).data,
			items: [customData, { id: 'text-1', kind: 'text', content: 'Notes' }],
			variables,
			annotations
		}
	}

	test.each([
		['public', toPublicDashboardInitialRenderPayload],
		['owner', toOwnerDashboardInitialRenderPayload]
	] as const)('the %s SSR payload carries variables and annotations', (_label, toPayload) => {
		const payload = toPayload(source)
		expect(payload.data.variables).toEqual(variables)
		expect(payload.data.annotations).toEqual(annotations)
		expect(hydrateDashboardInitialRenderPayload(payload).data).toMatchObject({ variables, annotations })
	})

	test('omits absent variables and annotations instead of serializing undefined', () => {
		const payload = toPublicDashboardInitialRenderPayload(dashboard([]))
		expect(payload.data).not.toHaveProperty('variables')
		expect(payload.data).not.toHaveProperty('annotations')
	})

	test('strips custom-data rows from the SSR payload while keeping the rest of the card', () => {
		const payload = toPublicDashboardInitialRenderPayload(source)
		const { rows: _rows, ...withoutRows } = customData
		expect(payload.data.items[0]).toEqual(withoutRows)
		expect(payload.data.items[0]).not.toHaveProperty('rows')
		expect(payload.data.items[1]).toEqual({ id: 'text-1', kind: 'text', content: 'Notes' })
		expect(toOwnerDashboardInitialRenderPayload(source).data.items[0]).not.toHaveProperty('rows')
	})

	test('keeps custom-data rows in the public API response', () => {
		const response = toPublicDashboardResponse(source)
		expect(response.data.items[0]).toBe(customData)
		expect(response.data.items[0]).toHaveProperty('rows', customData.rows)
		expect(response.data.variables).toEqual(variables)
		expect(response.data.annotations).toEqual(annotations)
		expect(response.data).not.toHaveProperty('aiUndoState')
		expect(response).not.toHaveProperty('user')
	})
})
