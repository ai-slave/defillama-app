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
import { Icon } from '~/ui/Icon'

const VERTICAL_SORTING_MODIFIERS = [restrictToVerticalAxis, restrictToParentElement]

type ReorderableEditorialTagListProps = {
	items: Array<ArticleDocument>
	onReorder: (items: Array<EditorialTagOrderItem>) => void
	onRemove: (articleId: string) => void
	pending: boolean
	reorderPending: boolean
}

export function ReorderableEditorialTagList({
	items,
	onReorder,
	onRemove,
	pending,
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
					<ul className="grid divide-y divide-(--border-medium) overflow-hidden rounded-md border border-medium bg-page/40">
						{items.map((article, index) => (
							<SortableEditorialTagRow
								key={article.id}
								article={article}
								position={index + 1}
								onRemove={() => onRemove(article.id)}
								disabled={disabled}
							/>
						))}
					</ul>
				</SortableContext>
			</DndContext>
			<p className="text-xs text-tertiary">Drag to reorder. Order is reflected on /research after save.</p>
		</div>
	)
}

function SortableEditorialTagRow({
	article,
	position,
	onRemove,
	disabled
}: {
	article: ArticleDocument
	position: number
	onRemove: () => void
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
			leading={
				<button
					type="button"
					disabled={disabled}
					className={`flex size-8 shrink-0 touch-none items-center justify-center rounded-md text-tertiary hover:bg-research-wash focus-visible:bg-research-wash disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-research-wash-strong dark:focus-visible:bg-research-wash-strong ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
					aria-label={`Drag ${article.title}`}
					{...attributes}
					{...listeners}
				>
					<Icon name="menu" className="size-4" />
				</button>
			}
		/>
	)
}
