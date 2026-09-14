import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createContext, type CSSProperties, useContext, useMemo } from 'react'
import { Icon } from '~/ui/Icon'

interface SortableItemProps {
	id: string
	elementId?: string
	isTable?: boolean
	fullWidth?: boolean
	disabled?: boolean | { draggable: boolean; droppable: boolean }
	style?: CSSProperties | undefined
	children: React.ReactNode
	[key: string]: unknown
}

type SortableHandleValue = Pick<ReturnType<typeof useSortable>, 'setActivatorNodeRef' | 'attributes' | 'listeners'>

const SortableHandleContext = createContext<SortableHandleValue | null>(null)

export function SortableItem({
	id,
	elementId,
	isTable,
	fullWidth,
	disabled,
	style: styleOverride,
	children,
	...rest
}: SortableItemProps) {
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id,
		...(disabled === undefined ? {} : { disabled })
	})
	const draggable = !(disabled === true || (typeof disabled === 'object' && disabled.draggable))
	const style = {
		...styleOverride,
		transform: CSS.Translate.toString(transform),
		transition,
		gridColumn: isTable || fullWidth ? '1/-1' : undefined
	}

	const handle = useMemo(
		() => (draggable ? { setActivatorNodeRef, attributes, listeners } : null),
		[draggable, setActivatorNodeRef, attributes, listeners]
	)

	return (
		<SortableHandleContext.Provider value={handle}>
			<div
				ref={setNodeRef}
				style={style}
				data-dragging={isDragging}
				{...(elementId === undefined ? {} : { id: elementId })}
				{...rest}
			>
				{children}
			</div>
		</SortableHandleContext.Provider>
	)
}

export function SortableDragHandle({ label = 'Drag to reorder', className }: { label?: string; className?: string }) {
	const handle = useContext(SortableHandleContext)
	if (!handle) return null
	const { setActivatorNodeRef, attributes, listeners } = handle
	return (
		<button
			type="button"
			ref={setActivatorNodeRef}
			{...attributes}
			{...listeners}
			aria-label={label}
			className={className ?? 'flex cursor-grab items-center text-tertiary hover:text-primary active:cursor-grabbing'}
		>
			<Icon name="grip-vertical" height={14} width={14} />
		</button>
	)
}
