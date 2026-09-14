import { arrayMove } from '@dnd-kit/sortable'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { dashboardItemHasStreamSources } from '../dashboardStreamCapabilities'
import type { SectionConfig } from '../types'

export interface DashboardLayoutGroup {
	heading: SectionConfig | null
	items: Array<DashboardItemConfig>
}

export interface DashboardLayoutTab {
	section: SectionConfig
	groups: Array<DashboardLayoutGroup>
}

export interface DashboardLayout {
	shared: Array<DashboardLayoutGroup>
	tabs: Array<DashboardLayoutTab> | null
}

function groupItems(items: ReadonlyArray<DashboardItemConfig>): Array<DashboardLayoutGroup> {
	const groups: Array<DashboardLayoutGroup> = []
	let current: DashboardLayoutGroup = { heading: null, items: [] }
	for (const item of items) {
		if (item.kind === 'section') {
			if (current.heading !== null || current.items.length > 0) groups.push(current)
			current = { heading: item, items: [] }
			continue
		}
		current.items.push(item)
	}
	if (current.heading !== null || current.items.length > 0 || groups.length === 0) groups.push(current)
	return groups
}

export function dashboardHasTabs(items: ReadonlyArray<DashboardItemConfig>): boolean {
	return items.some((item) => item.kind === 'section' && item.displayAs === 'tab')
}

export function buildDashboardLayout(items: ReadonlyArray<DashboardItemConfig>): DashboardLayout {
	if (!dashboardHasTabs(items)) return { shared: groupItems(items), tabs: null }
	const shared: Array<DashboardItemConfig> = []
	const tabs: Array<{ section: SectionConfig; items: Array<DashboardItemConfig> }> = []
	for (const item of items) {
		if (item.kind === 'section' && item.displayAs === 'tab') {
			tabs.push({ section: item, items: [] })
			continue
		}
		const tab = tabs.at(-1)
		if (tab) tab.items.push(item)
		else shared.push(item)
	}
	return {
		shared: shared.length > 0 ? groupItems(shared) : [],
		tabs: tabs.map((tab) => ({ section: tab.section, groups: groupItems(tab.items) }))
	}
}

export function findTabForItem(layout: DashboardLayout, itemId: string): SectionConfig | null {
	if (!layout.tabs) return null
	for (const tab of layout.tabs) {
		if (tab.section.id === itemId) return tab.section
		for (const group of tab.groups) {
			if (group.heading?.id === itemId || group.items.some((item) => item.id === itemId)) return tab.section
		}
	}
	return null
}

export function findGroupHeadingForItem(layout: DashboardLayout, itemId: string): SectionConfig | null {
	const groups = [...layout.shared, ...(layout.tabs?.flatMap((tab) => tab.groups) ?? [])]
	for (const group of groups) {
		if (group.heading && group.items.some((item) => item.id === itemId)) return group.heading
	}
	return null
}

export function sectionRange(items: ReadonlyArray<DashboardItemConfig>, sectionId: string): [number, number] | null {
	const start = items.findIndex((item) => item.id === sectionId && item.kind === 'section')
	if (start === -1) return null
	const section = items[start]
	if (!section || section.kind !== 'section') return null
	let end = items.length
	for (let index = start + 1; index < items.length; index++) {
		const item = items[index]
		if (!item || item.kind !== 'section') continue
		if (section.displayAs === 'tab' ? item.displayAs === 'tab' : true) {
			end = index
			break
		}
	}
	return [start, end]
}

function enclosingTabStart(items: ReadonlyArray<DashboardItemConfig>, index: number): number {
	for (let cursor = index - 1; cursor >= 0; cursor--) {
		const item = items[cursor]
		if (item?.kind === 'section' && item.displayAs === 'tab') return cursor
	}
	return -1
}

export function moveSectionWithChildren(
	items: Array<DashboardItemConfig>,
	sectionId: string,
	direction: -1 | 1
): Array<DashboardItemConfig> {
	const range = sectionRange(items, sectionId)
	const section = items[range?.[0] ?? -1]
	if (!range || section?.kind !== 'section') return items
	const [start, end] = range
	const block = items.slice(start, end)
	const before = items.slice(0, start)
	const after = items.slice(end)
	const lowerBound = section.displayAs === 'tab' ? 0 : enclosingTabStart(items, start) + 1
	if (direction === -1) {
		if (start <= lowerBound) return items
		const startsPreviousBlock = (candidate: DashboardItemConfig | undefined) =>
			candidate?.kind === 'section' && (section.displayAs !== 'tab' || candidate.displayAs === 'tab')
		let previousStart = start - 1
		while (previousStart > lowerBound) {
			if (startsPreviousBlock(items[previousStart])) break
			previousStart--
		}
		if (section.displayAs === 'tab' && !startsPreviousBlock(items[previousStart])) return items
		const previousSectionStart = startsPreviousBlock(items[previousStart]) ? previousStart : lowerBound
		return [...items.slice(0, previousSectionStart), ...block, ...items.slice(previousSectionStart, start), ...after]
	}
	if (after.length === 0) return items
	const nextItem = after[0]
	if (!nextItem) return items
	if (nextItem.kind !== 'section') {
		return items
	}
	if (section.displayAs !== 'tab' && nextItem.displayAs === 'tab') return items
	const nextRange = sectionRange(items, nextItem.id)
	if (!nextRange) return items
	const nextBlock = items.slice(nextRange[0], nextRange[1])
	return [...before, ...nextBlock, ...block, ...items.slice(nextRange[1])]
}

export function removeSectionKeepingChildren(
	items: Array<DashboardItemConfig>,
	sectionId: string
): Array<DashboardItemConfig> {
	const index = items.findIndex((item) => item.id === sectionId && item.kind === 'section')
	return index === -1 ? items : items.filter((_, itemIndex) => itemIndex !== index)
}

export function visibleGroupBounds(
	items: ReadonlyArray<DashboardItemConfig>,
	itemId: string,
	activeTabId: string | null
): [number, number] | null {
	const index = items.findIndex((item) => item.id === itemId)
	if (index === -1) return null
	const hasTabs = dashboardHasTabs(items)
	let start = 0
	let end = items.length
	if (hasTabs) {
		const layout = buildDashboardLayout(items)
		const tab = findTabForItem(layout, itemId)
		if (tab && activeTabId !== null && tab.id !== activeTabId) return null
		if (tab) {
			const range = sectionRange(items, tab.id)
			if (range) {
				start = range[0] + 1
				end = range[1]
			}
		} else {
			end = items.findIndex((item) => item.kind === 'section' && item.displayAs === 'tab')
			if (end === -1) end = items.length
		}
	}
	return [start, end]
}

export function moveDashboardItemWithinBounds(
	items: Array<DashboardItemConfig>,
	index: number,
	direction: -1 | 1,
	bounds: [number, number] | null
): Array<DashboardItemConfig> {
	const target = index + direction
	const [start, end] = bounds ?? [0, items.length]
	if (index < start || index >= end || target < start || target >= end) return items
	return arrayMove(items, index, target)
}

export function streamPrefetchItemIds(items: ReadonlyArray<DashboardItemConfig>, count: number): Array<string> {
	const ids: Array<string> = []
	const layout = buildDashboardLayout(items)
	const groups = [...layout.shared, ...(layout.tabs?.[0]?.groups ?? [])]
	for (const group of groups) {
		for (const item of group.items) {
			if (ids.length >= count) return ids
			if (dashboardItemHasStreamSources(item)) ids.push(item.id)
		}
	}
	return ids
}

export function resolveActiveTabId(
	items: ReadonlyArray<DashboardItemConfig>,
	requestedTabId: string | null
): string | null {
	const layout = buildDashboardLayout(items)
	if (!layout.tabs) return null
	if (requestedTabId !== null && layout.tabs.some((tab) => tab.section.id === requestedTabId)) return requestedTabId
	return layout.tabs[0]?.section.id ?? null
}

export function appendItemsToTab(
	items: Array<DashboardItemConfig>,
	newItems: ReadonlyArray<DashboardItemConfig>,
	requestedTabId: string | null
): Array<DashboardItemConfig> {
	if (newItems.length === 0) return items
	const activeTabId = resolveActiveTabId(items, requestedTabId)
	const range = activeTabId === null ? null : sectionRange(items, activeTabId)
	const insertAt = range ? range[1] : items.length
	return [...items.slice(0, insertAt), ...newItems, ...items.slice(insertAt)]
}

export function insertItemsAfter(
	items: Array<DashboardItemConfig>,
	anchorItemId: string,
	newItems: ReadonlyArray<DashboardItemConfig>
): Array<DashboardItemConfig> {
	if (newItems.length === 0) return items
	const anchorIndex = items.findIndex((item) => item.id === anchorItemId)
	if (anchorIndex === -1) return [...items, ...newItems]
	return [...items.slice(0, anchorIndex + 1), ...newItems, ...items.slice(anchorIndex + 1)]
}

export function insertItemsBefore(
	items: Array<DashboardItemConfig>,
	anchorItemId: string,
	newItems: ReadonlyArray<DashboardItemConfig>
): Array<DashboardItemConfig> {
	if (newItems.length === 0) return items
	const anchorIndex = items.findIndex((item) => item.id === anchorItemId)
	if (anchorIndex === -1) return [...items, ...newItems]
	return [...items.slice(0, anchorIndex), ...newItems, ...items.slice(anchorIndex)]
}

function sectionGroupBounds(items: ReadonlyArray<DashboardItemConfig>, index: number): [number, number] {
	let start = 0
	for (let cursor = index - 1; cursor >= 0; cursor--) {
		if (items[cursor]?.kind === 'section') {
			start = cursor + 1
			break
		}
	}
	let end = items.length
	for (let cursor = index + 1; cursor < items.length; cursor++) {
		if (items[cursor]?.kind === 'section') {
			end = cursor
			break
		}
	}
	return [start, end]
}

export function dropGroupBounds(
	items: ReadonlyArray<DashboardItemConfig>,
	itemId: string,
	activeTabId: string | null
): [number, number] | null {
	const index = items.findIndex((item) => item.id === itemId)
	if (index === -1) return null
	const visible = visibleGroupBounds(items, itemId, activeTabId)
	if (!visible) return null
	const group = sectionGroupBounds(items, index)
	return [Math.max(visible[0], group[0]), Math.min(visible[1], group[1])]
}

export function resolveDropIndex(
	items: ReadonlyArray<DashboardItemConfig>,
	activeId: string,
	overId: string,
	activeTabId: string | null
): number | null {
	if (activeId === overId) return null
	const overIndex = items.findIndex((item) => item.id === overId)
	if (overIndex === -1) return null
	const bounds = dropGroupBounds(items, activeId, activeTabId)
	if (!bounds) return null
	if (overIndex < bounds[0] || overIndex >= bounds[1]) return null
	return overIndex
}
