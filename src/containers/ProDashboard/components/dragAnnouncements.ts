import { arrayMove } from '@dnd-kit/sortable'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import {
	buildDashboardLayout,
	type DashboardLayout,
	findGroupHeadingForItem,
	findTabForItem,
	headingGroupBounds,
	resolveDropIndex
} from '../dashboardLayout/buildDashboardLayout'
import { dashboardItemLabel } from './dashboardItemLabel'

export type DragAnnouncementContext = {
	items: ReadonlyArray<DashboardItemConfig>
	rawById: ReadonlyMap<string, DashboardItemConfig>
	layout: DashboardLayout
	activeTabId: string | null
}

export type DragPhase = 'start' | 'over' | 'end' | 'cancel'

function labelFor({ rawById }: DragAnnouncementContext, id: string) {
	const item = rawById.get(id)
	return item ? dashboardItemLabel(item) : 'Card'
}

/** Where a card sits among the cards of its section, e.g. "position 2 of 3 in Overview". Sections do not count. */
function placeFor({ items, layout, activeTabId }: DragAnnouncementContext, id: string) {
	const bounds = headingGroupBounds(items, id, activeTabId)
	if (!bounds) return null
	const siblings = items.slice(bounds[0], bounds[1]).filter((item) => item.kind !== 'section')
	const position = siblings.findIndex((item) => item.id === id) + 1
	if (position === 0) return null
	const group = findGroupHeadingForItem(layout, id) ?? findTabForItem(layout, id)
	return `position ${position} of ${siblings.length}${group ? ` in ${group.title}` : ''}`
}

function placeAfterDrop(context: DragAnnouncementContext, activeId: string, overId: string) {
	const fromIndex = context.items.findIndex((item) => item.id === activeId)
	const targetIndex = resolveDropIndex(context.items, activeId, overId, context.activeTabId)
	if (fromIndex === -1 || targetIndex === null) return placeFor(context, overId)
	const items = arrayMove([...context.items], fromIndex, targetIndex)
	return placeFor({ ...context, items, layout: buildDashboardLayout(items) }, activeId)
}

/** What a screen reader hears while a card is dragged with the keyboard or a pointer. */
export function dragAnnouncement(
	context: DragAnnouncementContext,
	phase: DragPhase,
	activeId: string,
	overId: string | null
): string {
	const label = labelFor(context, activeId)
	if (phase === 'start') {
		const place = placeFor(context, activeId)
		return `Picked up ${label}.${place ? ` Currently at ${place}.` : ''}`
	}
	if (phase === 'cancel') return `Moving ${label} cancelled.`
	if (phase === 'over') {
		if (overId === null) return `${label} is not over a card.`
		const overLabel = labelFor(context, overId)
		if (activeId !== overId && resolveDropIndex(context.items, activeId, overId, context.activeTabId) === null) {
			return `${label} is over ${overLabel}; cards can't move across a tab boundary.`
		}
		const place = placeAfterDrop(context, activeId, overId)
		return place ? `${label} is over ${place}.` : `${label} is over ${overLabel}.`
	}
	if (overId === null || activeId === overId) return `${label} was dropped where it started.`
	if (resolveDropIndex(context.items, activeId, overId, context.activeTabId) === null) {
		return `${label} stayed where it was. Cards can't move across a tab boundary.`
	}
	const place = placeAfterDrop(context, activeId, overId)
	return place ? `${label} moved to ${place}.` : `${label} moved.`
}
