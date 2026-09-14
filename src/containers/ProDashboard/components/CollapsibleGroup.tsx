import { type ReactNode, useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '~/hooks/usePrefersReducedMotion'
import { tw } from '~/ui/tw'

const COLLAPSIBLE_GROUP_CLASS = tw`grid grid-rows-[1fr] transition-[grid-template-rows] duration-260 ease-out-quart data-[collapsed=true]:grid-rows-[0fr]`
const COLLAPSE_FALLBACK_MS = 300

interface CollapsibleGroupProps {
	id: string
	collapsed: boolean
	contentClassName: string
	children: ReactNode
}

export function CollapsibleGroup({ id, collapsed, contentClassName, children }: CollapsibleGroupProps) {
	const reducedMotion = usePrefersReducedMotion()
	const outerRef = useRef<HTMLDivElement>(null)
	const [renderedCollapsed, setRenderedCollapsed] = useState(collapsed)
	const [rowsCollapsed, setRowsCollapsed] = useState(collapsed)
	const [settled, setSettled] = useState(true)

	if (renderedCollapsed !== collapsed) {
		setRenderedCollapsed(collapsed)
		if (collapsed) setRowsCollapsed(true)
		setSettled(reducedMotion)
	}

	useEffect(() => {
		if (settled || reducedMotion) return
		const node = outerRef.current
		const fallback = setTimeout(() => setSettled(true), COLLAPSE_FALLBACK_MS)
		const finish = (event: TransitionEvent) => {
			if (event.target !== node || event.propertyName !== 'grid-template-rows') return
			setSettled(true)
		}
		node?.addEventListener('transitionend', finish)
		return () => {
			clearTimeout(fallback)
			node?.removeEventListener('transitionend', finish)
		}
	}, [settled, reducedMotion])

	useEffect(() => {
		if (collapsed || !rowsCollapsed) return
		const frame = requestAnimationFrame(() => {
			void outerRef.current?.offsetHeight
			setRowsCollapsed(false)
		})
		return () => cancelAnimationFrame(frame)
	}, [collapsed, rowsCollapsed])

	const hidden = collapsed && settled
	return (
		<div
			id={id}
			ref={outerRef}
			data-collapsed={rowsCollapsed}
			hidden={hidden}
			inert={hidden}
			className={COLLAPSIBLE_GROUP_CLASS}
		>
			<div className={`min-h-0 ${rowsCollapsed || !settled ? 'overflow-hidden' : ''} ${contentClassName}`}>
				{children}
			</div>
		</div>
	)
}
