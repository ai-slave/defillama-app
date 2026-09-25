import { expect, test } from 'vitest'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { buildDashboardLayout } from '../dashboardLayout/buildDashboardLayout'
import { dragAnnouncement, type DragAnnouncementContext } from './dragAnnouncements'

function context(items: Array<DashboardItemConfig>, activeTabId: string | null = null): DragAnnouncementContext {
	return {
		items,
		rawById: new Map(items.map((item) => [item.id, item])),
		layout: buildDashboardLayout(items),
		activeTabId
	}
}

const grouped = context([
	{ id: 'overview', kind: 'section', title: 'Overview', displayAs: 'heading' },
	{ id: 'fees', kind: 'text', title: 'Fees notes', content: 'a' },
	{ id: 'tvl', kind: 'text', title: 'TVL notes', content: 'b' },
	{ id: 'later', kind: 'section', title: 'Later', displayAs: 'heading' },
	{ id: 'risks', kind: 'text', title: 'Risk notes', content: 'c' }
])

test('picking up a card names it and where it sits among the cards of its section', () => {
	expect(dragAnnouncement(grouped, 'start', 'tvl', null)).toBe(
		'Picked up TVL notes. Currently at position 2 of 2 in Overview.'
	)
})

test('dragging over a card in the same section announces the position it would take', () => {
	expect(dragAnnouncement(grouped, 'over', 'tvl', 'fees')).toBe('TVL notes is over position 1 of 2 in Overview.')
	expect(dragAnnouncement(grouped, 'over', 'tvl', null)).toBe('TVL notes is not over a card.')
})

test('dragging into another section explains that cards stay inside their section', () => {
	expect(dragAnnouncement(grouped, 'over', 'tvl', 'risks')).toBe(
		'TVL notes is over Risk notes; cards move only inside their own section.'
	)
	expect(dragAnnouncement(grouped, 'end', 'tvl', 'risks')).toBe(
		'TVL notes stayed where it was. Cards move only inside their own section.'
	)
})

test('dropping reports the new position, or that the card did not move', () => {
	expect(dragAnnouncement(grouped, 'end', 'tvl', 'fees')).toBe('TVL notes moved to position 1 of 2 in Overview.')
	expect(dragAnnouncement(grouped, 'end', 'tvl', 'tvl')).toBe('TVL notes was dropped where it started.')
	expect(dragAnnouncement(grouped, 'end', 'tvl', null)).toBe('TVL notes was dropped where it started.')
	expect(dragAnnouncement(grouped, 'cancel', 'tvl', null)).toBe('Moving TVL notes cancelled.')
})

test('picking up a section names it without a card position, since sections are not counted among cards', () => {
	expect(dragAnnouncement(grouped, 'start', 'later', null)).toBe('Picked up Later.')
	expect(dragAnnouncement(grouped, 'over', 'later', 'later')).toBe('Later is over Later.')
})

test('an ungrouped dashboard counts every card and names no section', () => {
	const flat = context([
		{ id: 'fees', kind: 'text', title: 'Fees notes', content: 'a' },
		{ id: 'tvl', kind: 'text', title: 'TVL notes', content: 'b' },
		{ id: 'risks', kind: 'text', title: 'Risk notes', content: 'c' }
	])
	expect(dragAnnouncement(flat, 'start', 'risks', null)).toBe('Picked up Risk notes. Currently at position 3 of 3.')
})

test('a card on a tab is placed within the tab', () => {
	const tabbed = context(
		[
			{ id: 'first', kind: 'section', title: 'First', displayAs: 'tab' },
			{ id: 'fees', kind: 'text', title: 'Fees notes', content: 'a' },
			{ id: 'tvl', kind: 'text', title: 'TVL notes', content: 'b' }
		],
		'first'
	)
	expect(dragAnnouncement(tabbed, 'start', 'tvl', null)).toBe(
		'Picked up TVL notes. Currently at position 2 of 2 in First.'
	)
})

test('a card missing from the dashboard is announced generically', () => {
	expect(dragAnnouncement(grouped, 'cancel', 'gone', null)).toBe('Moving Card cancelled.')
})
