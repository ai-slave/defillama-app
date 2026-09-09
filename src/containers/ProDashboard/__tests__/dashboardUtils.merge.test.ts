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

	test('returns the local array itself when nothing merges in', () => {
		const base = [text('a')]
		const server = [text('a')]
		const local = [text('a'), text('c')]
		expect(mergeDashboardItems(base, server, local)).toBe(local)
	})
})
