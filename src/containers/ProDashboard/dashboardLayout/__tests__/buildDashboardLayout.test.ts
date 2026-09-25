import { describe, expect, test } from 'vitest'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import type { SectionConfig } from '../../types'
import {
	appendItemsToTab,
	buildDashboardLayout,
	dashboardHasTabs,
	dropGroupBounds,
	findGroupHeadingForItem,
	findTabForItem,
	insertItemsAfter,
	insertItemsBefore,
	moveDashboardItemWithinBounds,
	moveSectionWithChildren,
	removeSectionKeepingChildren,
	resolveActiveTabId,
	resolveDropIndex,
	sectionRange,
	streamPrefetchItemIds,
	visibleGroupBounds
} from '../buildDashboardLayout'

const text = (id: string): DashboardItemConfig => ({ id, kind: 'text', content: id })
const chart = (id: string): DashboardItemConfig => ({
	id,
	kind: 'chart',
	subjectType: 'chain',
	chain: 'Ethereum',
	type: 'tvl'
})
const heading = (id: string, title = id): SectionConfig => ({ id, kind: 'section', title, displayAs: 'heading' })
const tab = (id: string, title = id): SectionConfig => ({ id, kind: 'section', title, displayAs: 'tab' })
const ids = (items: ReadonlyArray<DashboardItemConfig>) => items.map((item) => item.id)

describe('buildDashboardLayout', () => {
	test('a dashboard without sections is one headingless group with the same items in order', () => {
		const items = [chart('a'), text('b'), chart('c')]
		const layout = buildDashboardLayout(items)
		expect(layout.tabs).toBeNull()
		expect(layout.shared).toHaveLength(1)
		expect(layout.shared[0]!.heading).toBeNull()
		expect(ids(layout.shared[0]!.items)).toEqual(['a', 'b', 'c'])
		expect(layout.shared[0]!.items[0]).toBe(items[0])
		expect(dashboardHasTabs(items)).toBe(false)
	})

	test('an empty dashboard still yields one empty group', () => {
		expect(buildDashboardLayout([])).toEqual({ shared: [{ heading: null, items: [] }], tabs: null })
	})

	test('heading sections split items into groups and own the cards after them', () => {
		const layout = buildDashboardLayout([chart('a'), heading('fees'), chart('b'), chart('c'), heading('empty')])
		expect(layout.tabs).toBeNull()
		expect(layout.shared.map((group) => [group.heading?.id ?? null, ids(group.items)])).toEqual([
			[null, ['a']],
			['fees', ['b', 'c']],
			['empty', []]
		])
	})

	test('a leading heading does not create an empty headingless group', () => {
		const layout = buildDashboardLayout([heading('first'), chart('a')])
		expect(layout.shared.map((group) => group.heading?.id ?? null)).toEqual(['first'])
	})

	test('tabs take the cards after them while cards before the first tab form the shared header', () => {
		const items = [
			chart('header'),
			heading('intro'),
			text('note'),
			tab('overview'),
			chart('a'),
			heading('details'),
			chart('b'),
			tab('fees'),
			chart('c')
		]
		const layout = buildDashboardLayout(items)
		expect(dashboardHasTabs(items)).toBe(true)
		expect(layout.shared.map((group) => [group.heading?.id ?? null, ids(group.items)])).toEqual([
			[null, ['header']],
			['intro', ['note']]
		])
		expect(layout.tabs).not.toBeNull()
		expect(layout.tabs!.map((entry) => entry.section.id)).toEqual(['overview', 'fees'])
		expect(layout.tabs![0]!.groups.map((group) => [group.heading?.id ?? null, ids(group.items)])).toEqual([
			[null, ['a']],
			['details', ['b']]
		])
		expect(layout.tabs![1]!.groups.map((group) => [group.heading?.id ?? null, ids(group.items)])).toEqual([
			[null, ['c']]
		])
	})

	test('a dashboard that starts with a tab has no shared groups', () => {
		const layout = buildDashboardLayout([tab('only'), chart('a')])
		expect(layout.shared).toEqual([])
		expect(layout.tabs).toHaveLength(1)
	})
})

describe('findTabForItem', () => {
	const items = [chart('header'), tab('overview'), chart('a'), heading('details'), chart('b'), tab('fees'), chart('c')]
	const layout = buildDashboardLayout(items)

	test('returns the owning tab for cards, nested headings and the tab itself', () => {
		expect(findTabForItem(layout, 'a')?.id).toBe('overview')
		expect(findTabForItem(layout, 'details')?.id).toBe('overview')
		expect(findTabForItem(layout, 'b')?.id).toBe('overview')
		expect(findTabForItem(layout, 'fees')?.id).toBe('fees')
		expect(findTabForItem(layout, 'c')?.id).toBe('fees')
	})

	test('returns null for shared header cards, unknown ids and flat dashboards', () => {
		expect(findTabForItem(layout, 'header')).toBeNull()
		expect(findTabForItem(layout, 'missing')).toBeNull()
		expect(findTabForItem(buildDashboardLayout([chart('a')]), 'a')).toBeNull()
	})
})

describe('findGroupHeadingForItem', () => {
	test('returns the heading owning a shared card', () => {
		const layout = buildDashboardLayout([chart('a'), heading('fees'), chart('b'), text('c')])
		expect(findGroupHeadingForItem(layout, 'b')?.id).toBe('fees')
		expect(findGroupHeadingForItem(layout, 'c')?.id).toBe('fees')
	})

	test('returns the heading owning a card nested inside a tab', () => {
		const layout = buildDashboardLayout([tab('overview'), chart('a'), heading('details'), chart('b')])
		expect(findGroupHeadingForItem(layout, 'b')?.id).toBe('details')
	})

	test('returns null for headingless cards, headings, tabs and unknown ids', () => {
		const layout = buildDashboardLayout([chart('a'), tab('overview'), chart('b'), heading('details'), chart('c')])
		expect(findGroupHeadingForItem(layout, 'a')).toBeNull()
		expect(findGroupHeadingForItem(layout, 'b')).toBeNull()
		expect(findGroupHeadingForItem(layout, 'details')).toBeNull()
		expect(findGroupHeadingForItem(layout, 'overview')).toBeNull()
		expect(findGroupHeadingForItem(layout, 'missing')).toBeNull()
	})
})

describe('sectionRange', () => {
	test('a heading owns items until the next section of any kind', () => {
		const items = [chart('a'), heading('h1'), chart('b'), chart('c'), heading('h2'), chart('d')]
		expect(sectionRange(items, 'h1')).toEqual([1, 4])
		expect(sectionRange(items, 'h2')).toEqual([4, 6])
	})

	test('a tab owns nested headings until the next tab', () => {
		const items = [tab('t1'), chart('a'), heading('h1'), chart('b'), tab('t2'), chart('c')]
		expect(sectionRange(items, 't1')).toEqual([0, 4])
		expect(sectionRange(items, 'h1')).toEqual([2, 4])
		expect(sectionRange(items, 't2')).toEqual([4, 6])
	})

	test('returns null for cards and unknown ids', () => {
		const items = [chart('a'), heading('h1')]
		expect(sectionRange(items, 'a')).toBeNull()
		expect(sectionRange(items, 'missing')).toBeNull()
	})
})

describe('moveSectionWithChildren', () => {
	test('the first tab never moves above the shared header', () => {
		const items = [chart('c0'), chart('c1'), tab('tabA'), chart('a1'), tab('tabB'), chart('b1')]
		expect(moveSectionWithChildren(items, 'tabA', -1)).toBe(items)
		expect(ids(moveSectionWithChildren(items, 'tabB', -1))).toEqual(['c0', 'c1', 'tabB', 'b1', 'tabA', 'a1'])
	})

	test('a heading section never leaves its tab', () => {
		const up = [tab('tabA'), chart('c1'), tab('tabB'), chart('c3'), heading('h'), chart('c4')]
		const movedUp = moveSectionWithChildren(up, 'h', -1)
		expect(ids(movedUp)).toEqual(['tabA', 'c1', 'tabB', 'h', 'c4', 'c3'])
		expect(moveSectionWithChildren(movedUp, 'h', -1)).toBe(movedUp)
		const down = [tab('tabA'), heading('h'), chart('c1'), tab('tabB'), chart('c2')]
		expect(moveSectionWithChildren(down, 'h', 1)).toBe(down)
		const withinTab = [tab('tabA'), chart('c0'), heading('h1'), chart('c1'), heading('h2'), chart('c2'), tab('tabB')]
		expect(ids(moveSectionWithChildren(withinTab, 'h1', -1))).toEqual(['tabA', 'h1', 'c1', 'c0', 'h2', 'c2', 'tabB'])
		expect(ids(moveSectionWithChildren(withinTab, 'h2', -1))).toEqual(['tabA', 'c0', 'h2', 'c2', 'h1', 'c1', 'tabB'])
	})
	const items = [chart('intro'), heading('h1'), chart('a'), chart('b'), heading('h2'), chart('c'), heading('h3')]

	test('moves a whole block above the previous section block', () => {
		expect(ids(moveSectionWithChildren(items, 'h2', -1))).toEqual(['intro', 'h2', 'c', 'h1', 'a', 'b', 'h3'])
	})

	test('moves a whole block below the next section block', () => {
		expect(ids(moveSectionWithChildren(items, 'h1', 1))).toEqual(['intro', 'h2', 'c', 'h1', 'a', 'b', 'h3'])
	})

	test('moving the first section up jumps ahead of the headingless intro cards', () => {
		expect(ids(moveSectionWithChildren(items, 'h1', -1))).toEqual(['h1', 'a', 'b', 'intro', 'h2', 'c', 'h3'])
	})

	test('returns the same reference at the edges and for unknown sections', () => {
		expect(moveSectionWithChildren(items, 'h3', 1)).toBe(items)
		const leading = [heading('h1'), chart('a'), heading('h2')]
		expect(moveSectionWithChildren(leading, 'h1', -1)).toBe(leading)
		expect(moveSectionWithChildren(items, 'missing', 1)).toBe(items)
		expect(moveSectionWithChildren(items, 'a', 1)).toBe(items)
	})

	test('moves a tab together with its nested headings', () => {
		const tabbed = [tab('t1'), chart('a'), heading('h1'), chart('b'), tab('t2'), chart('c')]
		expect(ids(moveSectionWithChildren(tabbed, 't2', -1))).toEqual(['t2', 'c', 't1', 'a', 'h1', 'b'])
		expect(ids(moveSectionWithChildren(tabbed, 't1', 1))).toEqual(['t2', 'c', 't1', 'a', 'h1', 'b'])
	})
})

describe('removeSectionKeepingChildren', () => {
	test('drops only the divider so its cards join the previous group', () => {
		const items = [chart('a'), heading('h1'), chart('b')]
		const next = removeSectionKeepingChildren(items, 'h1')
		expect(ids(next)).toEqual(['a', 'b'])
		expect(buildDashboardLayout(next).shared).toHaveLength(1)
	})

	test('returns the same reference for unknown ids and for non-section ids', () => {
		const items = [chart('a'), heading('h1'), chart('b')]
		expect(removeSectionKeepingChildren(items, 'missing')).toBe(items)
		expect(removeSectionKeepingChildren(items, 'a')).toBe(items)
	})
})

describe('visibleGroupBounds', () => {
	test('a flat dashboard lets cards move across the whole list', () => {
		const items = [chart('a'), heading('h1'), chart('b')]
		expect(visibleGroupBounds(items, 'b', null)).toEqual([0, 3])
		expect(visibleGroupBounds(items, 'missing', null)).toBeNull()
	})

	test('cards inside a tab are bounded by that tab', () => {
		const items = [chart('header'), tab('t1'), chart('a'), heading('h1'), chart('b'), tab('t2'), chart('c')]
		expect(visibleGroupBounds(items, 'a', 't1')).toEqual([2, 5])
		expect(visibleGroupBounds(items, 'b', 't1')).toEqual([2, 5])
		expect(visibleGroupBounds(items, 'c', 't2')).toEqual([6, 7])
	})

	test('shared header cards stop before the first tab', () => {
		const items = [chart('header'), chart('second'), tab('t1'), chart('a')]
		expect(visibleGroupBounds(items, 'header', 't1')).toEqual([0, 2])
	})

	test('cards in an inactive tab have no visible bounds', () => {
		const items = [tab('t1'), chart('a'), tab('t2'), chart('c')]
		expect(visibleGroupBounds(items, 'c', 't1')).toBeNull()
		expect(visibleGroupBounds(items, 'c', null)).toEqual([3, 4])
	})
})

describe('dropGroupBounds', () => {
	test('a card is bounded by its own heading group inside the visible tab', () => {
		const items = [chart('a'), heading('h1'), chart('b'), chart('c'), heading('h2'), chart('d')]
		expect(dropGroupBounds(items, 'a', null)).toEqual([0, 1])
		expect(dropGroupBounds(items, 'b', null)).toEqual([2, 4])
		expect(dropGroupBounds(items, 'd', null)).toEqual([5, 6])
		expect(dropGroupBounds(items, 'missing', null)).toBeNull()
	})
})

describe('resolveDropIndex', () => {
	test('a drop inside the same group returns the index of the card under the pointer', () => {
		const items = [chart('a'), chart('b'), chart('c')]
		expect(resolveDropIndex(items, 'a', 'c', null)).toBe(2)
		expect(resolveDropIndex(items, 'c', 'a', null)).toBe(0)
	})

	test('a drop over the card itself, or over an unknown id, is refused', () => {
		const items = [chart('a'), chart('b')]
		expect(resolveDropIndex(items, 'a', 'a', null)).toBeNull()
		expect(resolveDropIndex(items, 'a', 'missing', null)).toBeNull()
		expect(resolveDropIndex(items, 'missing', 'a', null)).toBeNull()
	})

	test('a drop across a heading boundary is refused in both directions', () => {
		const items = [chart('a'), heading('h1'), chart('b'), chart('c')]
		expect(resolveDropIndex(items, 'a', 'b', null)).toBeNull()
		expect(resolveDropIndex(items, 'b', 'a', null)).toBeNull()
		expect(resolveDropIndex(items, 'b', 'c', null)).toBe(3)
	})

	test('a drop onto a section row is refused', () => {
		const items = [chart('a'), chart('b'), heading('h1'), chart('c')]
		expect(resolveDropIndex(items, 'a', 'h1', null)).toBeNull()
		expect(resolveDropIndex(items, 'c', 'h1', null)).toBeNull()
	})

	test('a drop into another tab, or from an inactive tab, is refused', () => {
		const items = [chart('header'), tab('t1'), chart('a'), tab('t2'), chart('b')]
		expect(resolveDropIndex(items, 'a', 'b', 't1')).toBeNull()
		expect(resolveDropIndex(items, 'a', 'header', 't1')).toBeNull()
		expect(resolveDropIndex(items, 'b', 'a', 't1')).toBeNull()
	})
})

describe('moveDashboardItemWithinBounds', () => {
	const items = [chart('a'), chart('b'), chart('c'), chart('d')]

	test('moves within the bounds and refuses to cross them', () => {
		expect(ids(moveDashboardItemWithinBounds(items, 1, 1, [0, 4]))).toEqual(['a', 'c', 'b', 'd'])
		expect(ids(moveDashboardItemWithinBounds(items, 1, -1, [0, 4]))).toEqual(['b', 'a', 'c', 'd'])
		expect(moveDashboardItemWithinBounds(items, 1, -1, [1, 3])).toBe(items)
		expect(moveDashboardItemWithinBounds(items, 2, 1, [1, 3])).toBe(items)
		expect(moveDashboardItemWithinBounds(items, 0, 1, [1, 3])).toBe(items)
	})

	test('null bounds fall back to the whole list', () => {
		expect(moveDashboardItemWithinBounds(items, 0, -1, null)).toBe(items)
		expect(moveDashboardItemWithinBounds(items, 3, 1, null)).toBe(items)
		expect(ids(moveDashboardItemWithinBounds(items, 3, -1, null))).toEqual(['a', 'b', 'd', 'c'])
	})
})

describe('streamPrefetchItemIds', () => {
	test('skips sections and cards without stream sources and takes the first streamed widgets', () => {
		const items = [heading('h1'), chart('a'), text('b'), heading('h2'), chart('c'), chart('d'), chart('e')]
		expect(streamPrefetchItemIds(items, 3)).toEqual(['a', 'c', 'd'])
		expect(streamPrefetchItemIds(items, 10)).toEqual(['a', 'c', 'd', 'e'])
		expect(streamPrefetchItemIds(items, 0)).toEqual([])
	})

	test('covers the shared header and the first tab only', () => {
		const items = [chart('header'), tab('t1'), chart('a'), heading('h1'), chart('b'), tab('t2'), chart('c'), chart('d')]
		expect(streamPrefetchItemIds(items, 8)).toEqual(['header', 'a', 'b'])
		expect(streamPrefetchItemIds(items, 2)).toEqual(['header', 'a'])
	})
})

describe('resolveActiveTabId', () => {
	test('returns null without tabs, the requested tab when it exists, otherwise the first tab', () => {
		expect(resolveActiveTabId([chart('a'), heading('h1')], 'h1')).toBeNull()
		const items = [chart('header'), tab('t1'), chart('a'), tab('t2'), chart('b')]
		expect(resolveActiveTabId(items, 't2')).toBe('t2')
		expect(resolveActiveTabId(items, 'missing')).toBe('t1')
		expect(resolveActiveTabId(items, null)).toBe('t1')
	})
})

describe('appendItemsToTab', () => {
	test('appends at the end of a flat dashboard', () => {
		const items = [chart('a'), heading('h1'), chart('b')]
		expect(ids(appendItemsToTab(items, [chart('n')], null))).toEqual(['a', 'h1', 'b', 'n'])
	})

	test('inserts at the end of the active tab, before the next tab', () => {
		const items = [chart('header'), tab('t1'), chart('a'), heading('h1'), chart('b'), tab('t2'), chart('c')]
		expect(ids(appendItemsToTab(items, [chart('n')], 't1'))).toEqual(['header', 't1', 'a', 'h1', 'b', 'n', 't2', 'c'])
		expect(ids(appendItemsToTab(items, [chart('n')], 't2'))).toEqual(['header', 't1', 'a', 'h1', 'b', 't2', 'c', 'n'])
	})

	test('falls back to the first tab for unknown ids and returns the same reference for no items', () => {
		const items = [tab('t1'), chart('a'), tab('t2'), chart('c')]
		expect(ids(appendItemsToTab(items, [chart('n')], 'missing'))).toEqual(['t1', 'a', 'n', 't2', 'c'])
		expect(appendItemsToTab(items, [], 't2')).toBe(items)
	})
})

describe('insertItemsAfter', () => {
	test('places new items right after the anchor and appends when the anchor is missing', () => {
		const items = [chart('a'), chart('b'), chart('c')]
		expect(ids(insertItemsAfter(items, 'a', [chart('n')]))).toEqual(['a', 'n', 'b', 'c'])
		expect(ids(insertItemsAfter(items, 'c', [chart('n')]))).toEqual(['a', 'b', 'c', 'n'])
		expect(ids(insertItemsAfter(items, 'missing', [chart('n')]))).toEqual(['a', 'b', 'c', 'n'])
		expect(insertItemsAfter(items, 'a', [])).toBe(items)
	})
})

describe('insertItemsBefore', () => {
	test('places new items right before the anchor and appends when the anchor is missing', () => {
		const items = [chart('a'), chart('b'), chart('c')]
		expect(ids(insertItemsBefore(items, 'a', [chart('n')]))).toEqual(['n', 'a', 'b', 'c'])
		expect(ids(insertItemsBefore(items, 'c', [chart('n')]))).toEqual(['a', 'b', 'n', 'c'])
		expect(ids(insertItemsBefore(items, 'missing', [chart('n')]))).toEqual(['a', 'b', 'c', 'n'])
		expect(insertItemsBefore(items, 'a', [])).toBe(items)
	})
})
