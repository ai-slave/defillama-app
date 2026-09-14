import { describe, expect, test } from 'vitest'
import type { ChartConfig } from '~/containers/Downloads/sql/chartConfig'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { DASHBOARD_CARD_HEIGHTS, type DashboardItemLayout } from '../types'
import {
	cardScaleStyle,
	DASHBOARD_CARD_HEIGHT_LABELS,
	DASHBOARD_CARD_HEIGHT_SCALE,
	dashboardItemSupportsHeight,
	getAdjacentCardHeight,
	getCardHeightScale,
	getDashboardItemHeight,
	getDashboardItemLayout,
	getEmbedCardHeight,
	getReadOnlyCardMinHeight,
	scaledCardHeight
} from './cardHeight'

const chart = (extra: DashboardItemLayout = {}): DashboardItemConfig => ({
	id: 'chart',
	kind: 'chart',
	subjectType: 'chain',
	chain: 'Ethereum',
	type: 'tvl',
	...extra
})

describe('card height presets', () => {
	test('every preset has a scale and a label', () => {
		expect(DASHBOARD_CARD_HEIGHTS).toEqual(['compact', 'default', 'tall'])
		expect(DASHBOARD_CARD_HEIGHT_SCALE).toEqual({ compact: 0.75, default: 1, tall: 1.4 })
		expect(Object.keys(DASHBOARD_CARD_HEIGHT_LABELS)).toEqual([...DASHBOARD_CARD_HEIGHTS])
	})

	test.each([
		['chart', true],
		['multi', true],
		['builder', true],
		['unified-table', true],
		['custom-data', true],
		['sql', true],
		['metric', false],
		['text', false],
		['section', false]
	] as const)('%s supports height: %s', (kind, expected) => {
		expect(dashboardItemSupportsHeight({ kind })).toBe(expected)
	})

	test('reads the stored height only for kinds that support it', () => {
		expect(getDashboardItemHeight(chart())).toBe('default')
		expect(getDashboardItemHeight(chart({ height: 'compact' }))).toBe('compact')
		expect(getDashboardItemHeight({ id: 'text', kind: 'text', content: 'x', height: 'tall' })).toBe('default')
		expect(getDashboardItemHeight({ id: 's', kind: 'section', title: 'S', displayAs: 'heading' })).toBe('default')
	})

	test('scales default to 1 and produce a CSS variable only when it changes something', () => {
		expect(getCardHeightScale(undefined)).toBe(1)
		expect(getCardHeightScale('tall')).toBe(1.4)
		expect(cardScaleStyle(undefined)).toBeUndefined()
		expect(cardScaleStyle('default')).toBeUndefined()
		expect(cardScaleStyle('compact')).toEqual({ '--card-scale': 0.75 })
		expect(cardScaleStyle('tall')).toEqual({ '--card-scale': 1.4 })
	})

	test('adjacent presets stop at the edges', () => {
		expect(getAdjacentCardHeight('default', -1)).toBe('compact')
		expect(getAdjacentCardHeight('default', 1)).toBe('tall')
		expect(getAdjacentCardHeight('compact', -1)).toBe('compact')
		expect(getAdjacentCardHeight('tall', 1)).toBe('tall')
	})

	test('scaled heights are rounded pixel values', () => {
		expect(scaledCardHeight(300, undefined)).toBe(300)
		expect(scaledCardHeight(300, 'compact')).toBe(225)
		expect(scaledCardHeight(345, 'tall')).toBe(483)
		expect(scaledCardHeight(301, 'compact')).toBe(226)
	})

	test('SQL and custom data cards reserve the height their chart actually renders at', () => {
		const chartConfig: ChartConfig = {
			chartType: 'line',
			xCol: 'day',
			yCols: ['value'],
			splitByCol: null,
			stackMode: 'off',
			rightAxisCols: [],
			seriesKinds: {},
			seriesColors: {},
			numberFormat: 'auto'
		}
		const sqlCard: DashboardItemConfig & { kind: 'sql' } = {
			id: 'sql',
			kind: 'sql',
			name: 'Query',
			chart: chartConfig,
			query: { sql: 'SELECT 1', tableSources: [] }
		}
		const customDataCard: DashboardItemConfig & { kind: 'custom-data' } = {
			id: 'custom',
			kind: 'custom-data',
			name: 'Treasury',
			columns: [{ name: 'value', type: 'DOUBLE' }],
			rows: [[1]],
			chart: chartConfig,
			displayMode: 'chart'
		}
		expect(getReadOnlyCardMinHeight(sqlCard)).toBe(432)
		expect(getReadOnlyCardMinHeight(customDataCard)).toBe(432)
		expect(getEmbedCardHeight(sqlCard)).toBe(486)
		expect(getEmbedCardHeight(customDataCard)).toBe(486)
		expect(getEmbedCardHeight({ ...sqlCard, height: 'compact' })).toBe(378)
		expect(getEmbedCardHeight({ ...customDataCard, height: 'tall' })).toBe(659)
	})

	test('layout extraction never emits undefined keys and ignores sections', () => {
		expect(getDashboardItemLayout(chart())).toEqual({})
		expect(getDashboardItemLayout(chart())).not.toHaveProperty('height')
		expect(getDashboardItemLayout(chart({ colSpan: 2, height: 'tall' }))).toEqual({ colSpan: 2, height: 'tall' })
		expect(getDashboardItemLayout(chart({ height: 'compact' }))).toEqual({ height: 'compact' })
		expect(getDashboardItemLayout({ id: 's', kind: 'section', title: 'S', displayAs: 'tab' })).toEqual({})
	})
})
