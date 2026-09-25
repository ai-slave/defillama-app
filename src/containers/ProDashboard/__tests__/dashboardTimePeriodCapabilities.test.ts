import { expect, test } from 'vitest'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { dashboardItemUsesTimePeriod, dashboardItemsUseTimePeriod } from '../dashboardTimePeriodCapabilities'
test.each([
	['chart', undefined, true],
	['rwa-overview', undefined, true],
	['rwa-asset', undefined, true],
	['dataset-table', 'cex-analytics', true],
	['dataset-table', 'protocols', false],
	['unified-table', undefined, false],
	['text', undefined, false],
	['income-statement', undefined, false],
	['unlocks-pie', undefined, false],
	['section', undefined, false],
	['custom-data', undefined, false]
])('period capability %s %s', (kind, datasetType, expected) => {
	expect(dashboardItemUsesTimePeriod({ kind, datasetType } as DashboardItemConfig)).toBe(expected)
})
test.each([
	['an empty dashboard', [], false],
	[
		'sections and custom data',
		[{ id: 's', kind: 'section', title: 'S', displayAs: 'heading' }, { kind: 'custom-data' }],
		false
	],
	[
		'a section beside a chart',
		[{ id: 's', kind: 'section', title: 'S', displayAs: 'heading' }, { kind: 'chart' }],
		true
	]
])('period capability of %s', (_name, items, expected) => {
	expect(dashboardItemsUseTimePeriod(items as Array<DashboardItemConfig>)).toBe(expected)
})
