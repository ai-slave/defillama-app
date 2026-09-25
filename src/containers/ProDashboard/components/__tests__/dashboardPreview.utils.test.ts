import { expect, test } from 'vitest'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import {
	buildDashboardPreview,
	DASHBOARD_PREVIEW_COLUMN_BUDGET,
	previewSeed,
	previewSeries
} from '../dashboardPreview.utils'

function chart(id: string, type: string): DashboardItemConfig {
	return { id, kind: 'chart', type, subjectType: 'protocol', protocol: 'aave' } as unknown as DashboardItemConfig
}

test('chart shapes follow the chart type', () => {
	const [bars, area] = buildDashboardPreview([chart('a', 'volume'), chart('b', 'tvl')])
	expect(bars?.shape).toBe('bars')
	expect(area?.shape).toBe('area')
})

test('metrics and notes take one column, wide cards are capped at half width', () => {
	const tiles = buildDashboardPreview([
		{ id: 'm', kind: 'metric', subject: { itemType: 'chain', chain: 'Ethereum' }, type: 'tvl' },
		{ id: 't', kind: 'unified-table', colSpan: 2, rowHeaders: ['protocol'] },
		{ id: 'n', kind: 'text', title: 'Intro', content: 'Hello', colSpan: 2 }
	] as unknown as Array<DashboardItemConfig>)
	expect(tiles.map((tile) => tile.span)).toEqual([1, 2, 1])
	expect(tiles[2]?.label).toBe('Intro')
})

test('sections never become tiles', () => {
	const tiles = buildDashboardPreview([
		{ id: 's1', kind: 'section', title: 'Tabbed', displayAs: 'tab' },
		{ id: 's2', kind: 'section', title: 'Rows', displayAs: 'row' },
		chart('c', 'tvl')
	] as unknown as Array<DashboardItemConfig>)
	expect(tiles.map((tile) => tile.id)).toEqual(['c'])
})

test('tiles stop once the column budget is spent', () => {
	const items = Array.from({ length: 12 }, (_, index) => chart(`chart-${index}`, 'tvl'))
	const tiles = buildDashboardPreview(items)
	expect(tiles.reduce((sum, tile) => sum + tile.span, 0)).toBe(DASHBOARD_PREVIEW_COLUMN_BUDGET)
	expect(tiles).toHaveLength(DASHBOARD_PREVIEW_COLUMN_BUDGET / 2)
	expect(tiles.every((tile) => tile.shape === 'area')).toBe(true)
})

test('a note without a title is labelled Note', () => {
	const [tile] = buildDashboardPreview([
		{ id: 'x', kind: 'text', content: 'body' }
	] as unknown as Array<DashboardItemConfig>)
	expect(tile?.label).toBe('Note')
})

test('compact items fall back to the kind summary label', () => {
	const tiles = buildDashboardPreview([
		{ id: 'x', kind: 'unified-table' },
		{ id: 'y', kind: 'sql' }
	])
	expect(tiles.map((tile) => tile.label)).toEqual(['table', 'SQL chart'])
	expect(tiles.map((tile) => tile.shape)).toEqual(['table', 'table'])
})

test('full configs label tiles from the seo summary', () => {
	const [tile] = buildDashboardPreview([chart('a', 'tvl')])
	expect(tile?.label).toBe('Aave Tvl chart')
})

test('previewSeed is deterministic and separates ids', () => {
	expect(previewSeed('dash-1')).toBe(previewSeed('dash-1'))
	expect(previewSeed('dash-1')).not.toBe(previewSeed('dash-2'))
	expect(previewSeed('dash-1')).toBeGreaterThanOrEqual(0)
	expect(previewSeed('dash-1')).toBeLessThan(2 ** 31)
})

test('previewSeries draws a varying line inside the unit range that differs per dashboard', () => {
	const series = previewSeries(previewSeed('dash-1'))
	expect(series).toHaveLength(24)
	expect(series.every((value) => value >= 0 && value <= 1)).toBe(true)
	expect(new Set(series).size).toBeGreaterThan(1)
	expect(previewSeries(previewSeed('dash-2'))).not.toEqual(series)
	expect(previewSeries(12_345)).toEqual(previewSeries(12_345))
})

test('malformed stored items are skipped instead of throwing', () => {
	const items = [null, undefined, 5, 'x', { kind: 'nope' }, { kind: 'constructor' }, { kind: '__proto__' }, {}]
	expect(buildDashboardPreview(items as Parameters<typeof buildDashboardPreview>[0])).toEqual([])
})

test('tile labels are capped so the SSR payload stays bounded', () => {
	const [tile] = buildDashboardPreview([
		{ id: 'note', kind: 'text', title: 'A note title that keeps going well past the preview cell width' }
	])
	expect(tile?.label.length).toBeLessThanOrEqual(43)
	expect(tile?.label.endsWith('...')).toBe(true)
})
