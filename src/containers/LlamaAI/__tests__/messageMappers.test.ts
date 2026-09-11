import { describe, expect, test } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import {
	mapPersistedMessage,
	mapPersistedMessages,
	mapSharedSessionMessage,
	type PersistedMessage,
	type SharedSessionMessage
} from '~/containers/LlamaAI/messageMappers'
import type { DashboardItemConfig } from '~/containers/ProDashboard/dashboardItemConfig'

const chart: ChartConfiguration = {
	id: 'chart-1',
	type: 'line',
	title: 'TVL',
	description: 'TVL over time',
	axes: {
		x: { field: 'timestamp', label: 'Date', type: 'time' },
		yAxes: [{ id: 'left', fields: ['tvl'], label: 'TVL', position: 'left' }]
	},
	series: [
		{
			name: 'TVL',
			type: 'line',
			yAxisId: 'left',
			metricClass: 'stock',
			dataMapping: { xField: 'timestamp', yField: 'tvl' },
			styling: {}
		}
	],
	dataTransformation: { timeField: 'timestamp', metrics: ['tvl'] },
	displayOptions: {
		canStack: false,
		canShowPercentage: false,
		canShowCumulative: false,
		supportsGrouping: false
	}
}

const dashboardItem = {
	id: 'dashboard-item-1',
	kind: 'llamaai-chart',
	chartRef: 'chart-1',
	title: 'TVL'
} satisfies DashboardItemConfig

describe('messageMappers', () => {
	test('restores safe chart artifact refs for direct save after process loss', () => {
		const mapped = mapPersistedMessage({
			role: 'assistant',
			charts: [chart],
			chartData: { 'chart-1': [{ timestamp: 1, tvl: 100 }] },
			metadata: {
				chartSaveContext: {
					artifactRefs: {
						'chart-1': {
							artifactId: 'artifact-1',
							versionId: 'version-1',
							status: 'live',
							containsPremium: false,
							estimatedMaxCostUsd: 0
						}
					}
				}
			}
		})
		expect(mapped.charts?.[0]?.artifactRefs?.['chart-1']).toEqual({
			artifactId: 'artifact-1',
			versionId: 'version-1',
			status: 'live',
			containsPremium: false,
			estimatedMaxCostUsd: 0
		})
	})

	test('restores persisted dashboard chart data from message metadata', () => {
		const message: PersistedMessage = {
			role: 'assistant',
			content: 'Dashboard ready',
			messageId: 'message-1',
			charts: [chart],
			chartData: {
				'chart-1': [{ timestamp: 1, tvl: 100 }]
			},
			metadata: {
				dashboardConfig: {
					dashboardName: 'Protocol dashboard',
					items: [dashboardItem]
				},
				dashboardResult: {
					artifactOutcomes: [
						{
							itemId: 'dashboard-item-1',
							chartRef: 'chart-1',
							artifactId: 'artifact-1',
							versionId: 'version-1',
							status: 'live',
							containsPremium: false,
							estimatedMaxCostUsd: 0
						}
					]
				}
			}
		}

		const mapped = mapPersistedMessage(message)

		expect(mapped.id).toBe('message-1')
		expect(mapped.dashboards?.[0]).toMatchObject({
			id: 'dashboard_restored_message-1',
			dashboardName: 'Protocol dashboard'
		})
		expect(mapped.dashboards?.[0]?.chartData?.['chart-1']).toMatchObject({
			config: chart,
			data: [{ timestamp: 1, tvl: 100 }],
			toolChain: []
		})
		expect(mapped.dashboards?.[0]?.artifactOutcomes).toEqual([
			expect.objectContaining({ artifactId: 'artifact-1', status: 'live' })
		])
	})

	test('restores bundled dashboard preview data after reload without top-level chart fields', () => {
		const mapped = mapPersistedMessage({
			role: 'assistant',
			content: 'Dashboard ready',
			messageId: 'dashboard-message',
			metadata: {
				dashboardConfig: {
					dashboardName: 'Restored dashboard',
					items: [dashboardItem]
				},
				dashboardResult: {
					chartData: {
						'chart-1': {
							config: chart,
							data: [{ timestamp: 1, tvl: 100 }],
							toolChain: []
						}
					}
				}
			}
		})

		expect(mapped.dashboards?.[0]?.chartData).toEqual({
			'chart-1': {
				config: chart,
				data: [{ timestamp: 1, tvl: 100 }],
				toolChain: []
			}
		})
	})

	test('uses deterministic restored dashboard ids when message id is missing', () => {
		const message: PersistedMessage = {
			role: 'assistant',
			content: 'Dashboard ready',
			timestamp: 1,
			metadata: {
				dashboardConfig: {
					dashboardName: 'Protocol dashboard',
					items: [dashboardItem]
				}
			}
		}

		const first = mapPersistedMessage(message, 0)
		const second = mapPersistedMessage(message, 0)

		expect(first.dashboards?.[0]?.id).toBe(second.dashboards?.[0]?.id)
		expect(first.dashboards?.[0]?.id).toMatch(/^dashboard_restored_fallback_/)
	})

	test('maps shared flat chart data to the first chart dataset key', () => {
		const message: SharedSessionMessage = {
			role: 'assistant',
			content: 'Chart',
			messageId: 'shared-message',
			timestamp: 1,
			quotedText: 'quoted user message',
			charts: [{ ...chart, datasetName: 'tvl_dataset' }],
			chartData: [{ timestamp: 1, tvl: 100 }]
		}

		const mapped = mapSharedSessionMessage(message)

		expect(mapped.timestamp).toBe(1)
		expect(mapped.quotedText).toBe('quoted user message')
		expect(mapped.charts?.[0]?.chartData).toEqual({
			tvl_dataset: [{ timestamp: 1, tvl: 100 }]
		})
	})

	test('maps owned legacy flat chart data to the first chart dataset key', () => {
		const message: PersistedMessage = {
			role: 'assistant',
			content: 'Chart',
			charts: [{ ...chart, datasetName: 'tvl_dataset' }],
			chartData: [{ timestamp: '1772323200000', tvl: 100 }]
		}

		const mapped = mapPersistedMessage(message)

		expect(mapped.charts?.[0]?.chartData).toEqual({
			tvl_dataset: [{ timestamp: '1772323200000', tvl: 100 }]
		})
	})

	test('preserves restored dashboard items with missing chart refs', () => {
		const message: PersistedMessage = {
			role: 'assistant',
			content: 'Dashboard ready',
			charts: [chart],
			chartData: {
				'chart-1': [{ timestamp: 1, tvl: 100 }]
			},
			metadata: {
				dashboardConfig: {
					dashboardName: 'Protocol dashboard',
					items: [{ ...dashboardItem, chartRef: 'missing-chart' }, dashboardItem]
				}
			}
		}

		const mapped = mapPersistedMessage(message)

		expect(mapped.dashboards?.[0]?.items).toEqual([{ ...dashboardItem, chartRef: 'missing-chart' }, dashboardItem])
		expect(mapped.dashboards?.[0]?.chartData).toEqual({
			'chart-1': { config: chart, data: [{ timestamp: 1, tvl: 100 }], toolChain: [] }
		})
	})

	test('preserves legacy toolName-only executions from restored messages', () => {
		const mapped = mapPersistedMessage({
			role: 'assistant',
			content: 'Done',
			metadata: {
				toolExecutions: [{ toolName: 'search', success: true }]
			}
		})

		expect(mapped.toolExecutions?.[0]).toMatchObject({ name: 'search', toolName: 'search', success: true })
	})

	test('canonicalizes legacy fact check source type aliases from restored messages', () => {
		const mapped = mapPersistedMessage({
			role: 'assistant',
			content: 'Done',
			metadata: {
				factCheck: {
					references: [
						{ id: 1, label: 'Warehouse', sourceType: 'sql' },
						{ id: 2, label: 'Article', sourceType: 'article', url: 'https://example.com/report' },
						{ id: 3, label: 'Post', sourceType: 'twitter' },
						{ id: 4, label: 'Calculation', sourceType: 'code' },
						{ id: 5, label: '', url: 'https://example.com/source' }
					]
				}
			}
		})

		expect(mapped.citations?.map((citation) => citation.sourceType)).toEqual(['data', 'web', 'x', 'computed', 'web'])
		expect(mapped.citations?.[4]).toMatchObject({ id: 5, label: 'Source' })
		expect(mapped.legacyUrlCitations).toBeUndefined()
	})

	test('prefers the restored citations envelope over legacy fact check references', () => {
		const mapped = mapPersistedMessage({
			role: 'assistant',
			content: 'Done',
			citations: ['https://legacy.example'],
			metadata: {
				citations: {
					schemaVersion: 1,
					citations: [{ id: 1, label: 'RPC result', sourceType: 'tool', toolName: 'rpc_call' }]
				},
				factCheck: {
					references: [{ id: 2, label: 'Warehouse', sourceType: 'sql' }]
				}
			}
		})

		expect(mapped.citations).toEqual([{ id: 1, label: 'RPC result', sourceType: 'tool', toolName: 'rpc_call' }])
		expect(mapped.legacyUrlCitations).toBeUndefined()
	})

	test('keeps empty persisted lists empty', () => {
		expect(mapPersistedMessages(undefined)).toEqual([])
	})

	test('preserves epoch timestamps and drops invalid persisted timestamps', () => {
		expect(
			mapPersistedMessage({
				role: 'assistant',
				content: 'Epoch',
				timestamp: 0
			}).timestamp
		).toBe(0)

		expect(
			mapPersistedMessage({
				role: 'assistant',
				content: 'Invalid',
				timestamp: 'not-a-date'
			}).timestamp
		).toBeUndefined()
	})
})

describe('restored reasoning segments', () => {
	const metadata = {
		thinking: 'Plan.Compare.',
		thinkingSegments: [
			{ text: 'Plan.', toolIndex: 0 },
			{ text: 'Compare.', toolIndex: 1 }
		]
	}

	test('persisted and shared messages both keep the ordered segments', () => {
		expect(mapPersistedMessage({ role: 'assistant', content: 'Answer', metadata }).thinkingSegments).toEqual(
			metadata.thinkingSegments
		)
		expect(
			mapSharedSessionMessage({ role: 'assistant', content: 'Answer', metadata, timestamp: 1 }).thinkingSegments
		).toEqual(metadata.thinkingSegments)
	})
})
