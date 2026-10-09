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
import { EditorialTagRow } from '~/containers/Articles/admin/EditorialTagRow'
import { buildEditorialTagReorderPayload, type EditorialTagOrderItem } from '~/containers/Articles/editorialTagOrder'
import type { ArticleDocument } from '~/containers/Articles/types'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'

const VERTICAL_SORTING_MODIFIERS = [restrictToVerticalAxis, restrictToParentElement]

type ReorderableEditorialTagListProps = {
	items: Array<ArticleDocument>
	onReorder: (items: Array<EditorialTagOrderItem>) => void
	onRemove: (articleId: string) => void
	pending: boolean
	removingId: string | null
	reorderPending: boolean
}

export function ReorderableEditorialTagList({
	items,
	onReorder,
	onRemove,
	pending,
	removingId,
	reorderPending
}: ReorderableEditorialTagListProps) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	)
	const disabled = pending || reorderPending

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event
		if (!over || active.id === over.id || disabled) return

		const oldIndex = items.findIndex((article) => article.id === active.id)
		const newIndex = items.findIndex((article) => article.id === over.id)
		if (oldIndex === -1 || newIndex === -1) return

		const reordered = arrayMove(items, oldIndex, newIndex)
		const payload = buildEditorialTagReorderPayload(items, reordered)
		if (payload.length === 0) return

		onReorder(payload)
	}

	const sortableIds = items.map((article) => article.id)

	return (
		<div className="grid gap-2">
			<DndContext sensors={sensors} onDragEnd={handleDragEnd} modifiers={VERTICAL_SORTING_MODIFIERS}>
				<SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
					<ul className="grid divide-y divide-(--border-medium) overflow-hidden rounded-md border border-medium bg-page">
						{items.map((article, index) => (
							<SortableEditorialTagRow
								key={article.id}
								article={article}
								position={index + 1}
								onRemove={() => onRemove(article.id)}
								removing={removingId === article.id}
								disabled={disabled}
							/>
						))}
					</ul>
				</SortableContext>
			</DndContext>
			<p className="body-sm text-tertiary">Drag to reorder. Order is reflected on /research after save.</p>
		</div>
	)
}

function SortableEditorialTagRow({
	article,
	position,
	onRemove,
	removing,
	disabled
}: {
	article: ArticleDocument
	position: number
	onRemove: () => void
	removing: boolean
	disabled: boolean
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: article.id,
		disabled
	})

	const style: React.CSSProperties = {
		transform: CSS.Translate.toString(transform),
		transition
	}

	return (
		<EditorialTagRow
			ref={setNodeRef}
			style={style}
			data-dragging={isDragging}
			article={article}
			position={position}
			onRemove={onRemove}
			pending={disabled}
			removing={removing}
			leading={
				<Tooltip
					content="Drag to reorder"
					render={
						<Button
							variant="ghost"
							size="sm"
							square
							disabled={disabled}
							accessibleWhenDisabled
							className="touch-none"
							aria-label={`Drag ${article.title}`}
							{...attributes}
							{...listeners}
						/>
					}
				>
					<Icon name="menu" className="size-4 text-tertiary" />
				</Tooltip>
			}
		/>
	)
}
