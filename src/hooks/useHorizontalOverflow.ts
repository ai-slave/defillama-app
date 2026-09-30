import { useCallback, useRef, useState } from 'react'

const SCROLL_EDGE_TOLERANCE = 10
const DEFAULT_SCROLL_PAGE = 640

const NO_OVERFLOW = { canScrollLeft: false, canScrollRight: false }

export type HorizontalScrollDirection = 'left' | 'right'

export function useHorizontalOverflow<T extends HTMLElement = HTMLDivElement>(pageSize = DEFAULT_SCROLL_PAGE) {
	const elementRef = useRef<T | null>(null)
	const [overflow, setOverflow] = useState(NO_OVERFLOW)

	// Observes the element while it is attached. A caller that composes this ref must return its cleanup.
	const ref = useCallback((element: T | null) => {
		if (!element) return
		elementRef.current = element
		let frame: number | null = null
		const read = () => {
			frame = null
			const { scrollLeft, scrollWidth, clientWidth } = element
			const next = {
				canScrollLeft: scrollLeft > 0,
				canScrollRight: scrollLeft < scrollWidth - clientWidth - SCROLL_EDGE_TOLERANCE
			}
			setOverflow((previous) =>
				previous.canScrollLeft === next.canScrollLeft && previous.canScrollRight === next.canScrollRight
					? previous
					: next
			)
		}
		const schedule = () => {
			if (frame !== null) return
			frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(read) : null
			if (frame === null) read()
		}
		schedule()
		element.addEventListener('scroll', schedule, { passive: true })
		const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null
		resizeObserver?.observe(element)
		const mutationObserver = typeof MutationObserver === 'function' ? new MutationObserver(schedule) : null
		mutationObserver?.observe(element, { childList: true, subtree: true, characterData: true })
		window.addEventListener('resize', schedule)
		return () => {
			if (frame !== null) cancelAnimationFrame(frame)
			element.removeEventListener('scroll', schedule)
			resizeObserver?.disconnect()
			mutationObserver?.disconnect()
			window.removeEventListener('resize', schedule)
			elementRef.current = null
			setOverflow(NO_OVERFLOW)
		}
	}, [])

	const scrollByPage = useCallback(
		(direction: HorizontalScrollDirection) => {
			elementRef.current?.scrollBy({ left: direction === 'left' ? -pageSize : pageSize, behavior: 'smooth' })
		},
		[pageSize]
	)

	return { ref, canScrollLeft: overflow.canScrollLeft, canScrollRight: overflow.canScrollRight, scrollByPage }
}
