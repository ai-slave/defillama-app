import { useCallback, useLayoutEffect, useRef, useState, type MouseEventHandler } from 'react'

interface HoverState {
	index: number
	dataLength: number
}

function positionTooltip(el: HTMLDivElement | null, x: number, y: number) {
	if (!el) return
	const flipX = x + 12 + el.offsetWidth > window.innerWidth
	const flipY = y - 12 + el.offsetHeight > window.innerHeight
	el.style.left = `${flipX ? x - el.offsetWidth - 12 : x + 12}px`
	el.style.top = `${flipY ? y - el.offsetHeight + 12 : y - 12}px`
}

export function useSmolChartHover(dataLength: number) {
	const containerRef = useRef<HTMLDivElement>(null)
	const tooltipRef = useRef<HTMLDivElement>(null)
	const pointerPositionRef = useRef({ x: 0, y: 0 })
	const hoverStateRef = useRef<HoverState | null>(null)
	const [hoverState, setHoverState] = useState<HoverState | null>(null)

	const hoveredIndex = hoverState?.dataLength === dataLength ? hoverState.index : null
	const clearHover = useCallback(() => {
		if (hoverStateRef.current === null) return
		hoverStateRef.current = null
		setHoverState(null)
	}, [])

	const onMouseMove = useCallback<MouseEventHandler<HTMLDivElement>>(
		(event) => {
			const container = containerRef.current
			if (!container || dataLength === 0) return

			const rect = container.getBoundingClientRect()
			if (rect.width <= 0) {
				clearHover()
				return
			}

			const relativeX = event.clientX - rect.left
			if (relativeX < 0 || relativeX > rect.width) {
				clearHover()
				return
			}

			const index = Math.min(Math.floor((relativeX / rect.width) * dataLength), dataLength - 1)
			const pointerPosition = pointerPositionRef.current
			pointerPosition.x = event.clientX
			pointerPosition.y = event.clientY
			positionTooltip(tooltipRef.current, pointerPosition.x, pointerPosition.y)

			const currentHoverState = hoverStateRef.current
			if (currentHoverState?.index === index && currentHoverState.dataLength === dataLength) return

			const nextHoverState = { index, dataLength }
			hoverStateRef.current = nextHoverState
			setHoverState(nextHoverState)
		},
		[clearHover, dataLength]
	)

	useLayoutEffect(() => {
		if (hoverState && hoverState.dataLength !== dataLength) {
			clearHover()
			return
		}
		if (hoveredIndex == null) return
		const pointerPosition = pointerPositionRef.current
		positionTooltip(tooltipRef.current, pointerPosition.x, pointerPosition.y)
	}, [clearHover, dataLength, hoveredIndex, hoverState])

	return { containerRef, tooltipRef, hoveredIndex, onMouseMove, onMouseLeave: clearHover }
}
