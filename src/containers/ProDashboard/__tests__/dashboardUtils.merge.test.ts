import { describe, expect, test } from 'vitest'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { mergeDashboardItems } from '../utils/dashboardUtils'

const text = (id: string, content = id): DashboardItemConfig => ({ id, kind: 'text', content })

describe('mergeDashboardItems', () => {
	test('keeps items another client added', () => {
		const base = [text('a')]
		const server = [text('a'), text('b')]
		const local = [text('a')]
		expect(mergeDashboardItems(base, server, local)).toEqual([text('a'), text('b')])
	})

	test('drops items another client removed', () => {
		const base = [text('a'), text('b')]
		const server = [text('a')]
		const local = [text('a'), text('b')]
		expect(mergeDashboardItems(base, server, local)).toEqual([text('a')])
	})

	test('a local edit survives a concurrent remote removal', () => {
		const base = [text('a'), text('b')]
		const server = [text('a')]
		const local = [text('a'), text('b', 'edited')]
		expect(mergeDashboardItems(base, server, local)).toEqual([text('a'), text('b', 'edited')])
	})

	test('keeps items added locally', () => {
		const base = [text('a')]
		const server = [text('a')]
		const local = [text('a'), text('c')]
		expect(mergeDashboardItems(base, server, local)).toEqual([text('a'), text('c')])
	})

	test('keeps a local reorder', () => {
		const base = [text('a'), text('b')]
		const server = [text('a'), text('b')]
		const local = [text('b'), text('a')]
		expect(mergeDashboardItems(base, server, local)).toEqual([text('b'), text('a')])
	})

	test('a local edit beats the server copy of that item', () => {
		const base = [text('a', 'original')]
		const server = [text('a', 'server edit')]
		const local = [text('a', 'local edit')]
		expect(mergeDashboardItems(base, server, local)).toEqual([text('a', 'local edit')])
	})

	test('adopts server normalization of untouched items', () => {
		const base = [text('a', 'original')]
		const server = [text('a', 'normalized')]
		const local = [text('a', 'original')]
		expect(mergeDashboardItems(base, server, local)).toEqual([text('a', 'normalized')])
	})

	test('adopts a remote reorder when nothing changed locally', () => {
		const base = [text('a'), text('b')]
		const server = [text('b'), text('a')]
		const local = [text('a'), text('b')]
		expect(mergeDashboardItems(base, server, local)).toEqual([text('b'), text('a')])
	})

	test('appends remote adds after local adds during a concurrent edit', () => {
		const base = [text('a')]
		const server = [text('a'), text('b')]
		const local = [text('a'), text('c')]
		expect(mergeDashboardItems(base, server, local)).toEqual([text('a'), text('c'), text('b')])
	})

	test('never emits an id twice, even when both sides added the same id', () => {
		const base = [text('a')]
		const server = [text('a'), text('b'), text('x', 'server-x')]
		const local = [text('a'), text('x', 'local-x'), text('c')]
		const merged = mergeDashboardItems(base, server, local)
		expect(merged.map((item) => item.id)).toEqual(['a', 'x', 'c', 'b'])
		expect(new Set(merged.map((item) => item.id)).size).toBe(merged.length)
	})
})

const section = (id: string, title = id): DashboardItemConfig => ({ id, kind: 'section', title, displayAs: 'heading' })
const customData = (id: string, name = id): DashboardItemConfig => ({
	id,
	kind: 'custom-data',
	name,
	columns: [{ name: 'date', type: 'date' }],
	rows: [['2026-01-01']],
	chart: {
		chartType: 'line',
		xCol: 'date',
		yCols: [],
		splitByCol: null,
		stackMode: 'off',
		rightAxisCols: [],
		seriesKinds: {},
		seriesColors: {},
		numberFormat: 'auto'
	},
	displayMode: 'table'
})

describe('mergeDashboardItems with sections and custom data', () => {
	test('a card another client added lands at the end, inside the last local section', () => {
		const base = [text('a')]
		const server = [text('a'), text('b')]
		const local = [text('a'), section('overview'), text('c')]
		expect(mergeDashboardItems(base, server, local).map((item) => item.id)).toEqual(['a', 'overview', 'c', 'b'])
	})

	test('sections follow the same per-id rules as cards', () => {
		const base = [section('s', 'Original'), text('a')]
		const server = [section('s', 'Server title'), text('a')]
		const localEdit = [section('s', 'Local title'), text('a')]
		expect(mergeDashboardItems(base, server, localEdit)).toEqual([section('s', 'Local title'), text('a')])
		expect(mergeDashboardItems(base, server, [...base])).toEqual(server)
		expect(mergeDashboardItems(base, [text('a')], [section('s', 'Original'), text('a'), text('b')])).toEqual([
			text('a'),
			text('b')
		])
	})

	test('custom-data cards merge like any other card', () => {
		const base = [customData('d', 'Original')]
		const server = [customData('d', 'Original'), text('b')]
		const localEdit = [customData('d', 'Edited')]
		expect(mergeDashboardItems(base, server, localEdit)).toEqual([customData('d', 'Edited'), text('b')])
		const normalized = [customData('d', 'Normalized')]
		expect(mergeDashboardItems(base, normalized, [customData('d', 'Original'), text('c')])).toEqual([
			customData('d', 'Normalized'),
			text('c')
		])
		expect(mergeDashboardItems(base, [], [customData('d', 'Original')])).toEqual([])
	})
})
