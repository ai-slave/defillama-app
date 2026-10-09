import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type * as React from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { mutatePinnedMetrics } from '../pinnedUtils'
import { NavItemContent, navSortableRowStyles } from '../shared'
import type { TNavLink } from '../types'

const VERTICAL_SORTING_MODIFIERS = [restrictToVerticalAxis, restrictToParentElement]

export default function ReorderablePinnedPages({ pinnedPages }: { pinnedPages: Array<TNavLink> }) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	)

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event
		if (!over || active.id === over.id) return

		const oldIndex = pinnedPages.findIndex(({ route }) => route === active.id)
		const newIndex = pinnedPages.findIndex(({ route }) => route === over.id)

		if (oldIndex === -1 || newIndex === -1) return

		mutatePinnedMetrics((currentRoutes) => arrayMove(currentRoutes, oldIndex, newIndex))
	}

	const sortableItems = pinnedPages.map(({ route }) => route)

	return (
		<DndContext sensors={sensors} onDragEnd={handleDragEnd} modifiers={VERTICAL_SORTING_MODIFIERS}>
			<SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
				<div className="mt-1 flex flex-col gap-1">
					{pinnedPages.map((page) => (
						<ReorderableRow key={`mobile-nav-pinned-${page.name}-${page.route}`} page={page} />
					))}
				</div>
			</SortableContext>
		</DndContext>
	)
}

function ReorderableRow({ page }: { page: TNavLink }) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.route })

	const style: React.CSSProperties = {
		transform: CSS.Translate.toString(transform),
		transition
	}

	const handleUnpin = () => {
		mutatePinnedMetrics((routes) => routes.filter((route) => route !== page.route))
	}

	return (
		<div ref={setNodeRef} style={style} className="group relative" data-dragging={isDragging}>
			<div
				className={`${navSortableRowStyles} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} select-none`}
				data-dragging={isDragging}
			>
				<div className="flex w-full items-center gap-2">
					<Tooltip
						content="Drag to reorder"
						render={
							<Button
								variant="ghost"
								size="sm"
								square
								className="touch-none"
								aria-label={`Drag ${page.name}`}
								{...attributes}
								{...listeners}
							/>
						}
					>
						<Icon name="menu" className="size-4 text-tertiary" />
					</Tooltip>
					<NavItemContent name={page.name} icon={page.icon} attention={page.attention} />
					<Tooltip
						content="Unpin from navigation"
						render={
							<Button
								variant="ghost"
								size="sm"
								square
								className="ml-auto"
								aria-label={`Unpin ${page.name}`}
								onClick={() => handleUnpin()}
							/>
						}
					>
						<Icon name="x" className="size-4" />
					</Tooltip>
				</div>
			</div>
		</div>
	)
}
