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
import { keepFocus, neighborRowControl } from '~/ui/focus'
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
				<div className="flex flex-col">
					{pinnedPages.map((page) => (
						<PinnedPageRow key={`pinned-page-reorder-${page.name}-${page.route}`} page={page} />
					))}
				</div>
			</SortableContext>
		</DndContext>
	)
}

function PinnedPageRow({ page }: { page: TNavLink }) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.route })

	const style: React.CSSProperties = {
		transform: CSS.Translate.toString(transform),
		transition
	}

	return (
		<span
			ref={setNodeRef}
			style={style}
			className="group relative flex w-full items-start gap-1"
			data-dragging={isDragging}
		>
			<div
				className={`${navSortableRowStyles} w-full pr-10 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} select-none`}
				data-dragging={isDragging}
			>
				<div className="flex min-w-0 flex-1 items-center gap-2">
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
				</div>
			</div>
			<Tooltip
				content="Unpin from navigation"
				render={
					<Button
						variant="ghost"
						size="sm"
						square
						aria-label={`Unpin ${page.name}`}
						data-menu-name="Unpin from navigation"
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							// The neighbor's × shows only on hover or focus, so focus cannot land on it:
							// its drag handle takes focus.
							const row = e.currentTarget.parentElement!
							const next = neighborRowControl(row, row)?.querySelector('button')
							keepFocus(
								() => mutatePinnedMetrics((routes) => routes.filter((route) => route !== page.route)),
								() => next
							)
						}}
					/>
				}
				className="invisible absolute top-1/2 right-1 -translate-y-1/2 group-hover:visible group-has-focus-visible:visible pointer-coarse:group-focus-within:visible"
			>
				<Icon name="x" className="size-4" />
			</Tooltip>
		</span>
	)
}
