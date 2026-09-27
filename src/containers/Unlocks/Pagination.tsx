import { Children, useEffect, useReducer, useRef, useState } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'

interface PaginationProps {
	items: Array<React.ReactNode>
	startIndex?: number
}

type PaginationState = {
	visibleItems: number
	pageOverride: { startIndex: number; page: number | null }
	touchStart: number | null
	touchEnd: number | null
	isSwiping: boolean
	swipeOffset: number
}

type PageTransition = {
	direction: -1 | 1
	entering: boolean
}

type PaginationAction =
	| { type: 'SET_VISIBLE_ITEMS'; payload: number }
	| { type: 'SET_PAGE_OVERRIDE'; payload: { startIndex: number; page: number | null } }
	| { type: 'TOUCH_START'; payload: number }
	| { type: 'TOUCH_MOVE'; payload: number }
	| { type: 'TOUCH_END' }
	| { type: 'RESET_SWIPE' }

const initialState: PaginationState = {
	visibleItems: 1,
	pageOverride: { startIndex: 0, page: null },
	touchStart: null,
	touchEnd: null,
	isSwiping: false,
	swipeOffset: 0
}

function paginationReducer(state: PaginationState, action: PaginationAction): PaginationState {
	switch (action.type) {
		case 'SET_VISIBLE_ITEMS':
			return { ...state, visibleItems: action.payload }
		case 'SET_PAGE_OVERRIDE':
			return { ...state, pageOverride: action.payload }
		case 'TOUCH_START':
			return { ...state, touchStart: action.payload, touchEnd: null, isSwiping: true }
		case 'TOUCH_MOVE':
			if (state.touchStart === null || !state.isSwiping) return state
			return {
				...state,
				touchEnd: action.payload,
				swipeOffset: action.payload - state.touchStart
			}
		case 'TOUCH_END':
			return { ...state, isSwiping: false }
		case 'RESET_SWIPE':
			return { ...state, swipeOffset: 0, touchStart: null, touchEnd: null }
		default:
			return state
	}
}

export function Pagination({ items, startIndex = 0 }: PaginationProps) {
	const [state, dispatch] = useReducer(paginationReducer, {
		...initialState,
		pageOverride: { startIndex, page: null }
	})
	const paginationRef = useRef<HTMLDivElement>(null)
	const [pageTransition, setPageTransition] = useState<PageTransition>({ direction: 1, entering: false })

	// Reset page override when startIndex prop changes (derived state computed during render)
	const [prevStartIndex, setPrevStartIndex] = useState(startIndex)
	if (startIndex !== prevStartIndex) {
		setPrevStartIndex(startIndex)
		if (state.pageOverride.page != null && state.pageOverride.startIndex !== startIndex) {
			dispatch({ type: 'SET_PAGE_OVERRIDE', payload: { startIndex, page: null } })
		}
	}

	const { visibleItems, pageOverride, touchStart, touchEnd, isSwiping, swipeOffset } = state
	const minSwipeDistance = 50

	useEffect(() => {
		const calculateVisibleItems = () => {
			if (typeof document !== 'undefined' && paginationRef.current) {
				const paginationWidth = paginationRef.current.offsetWidth
				if (paginationWidth < 768) {
					dispatch({ type: 'SET_VISIBLE_ITEMS', payload: 1 })
				} else {
					const itemsPerPage = Math.max(1, Math.floor((paginationWidth - 100) / 390))
					dispatch({ type: 'SET_VISIBLE_ITEMS', payload: itemsPerPage })
				}
			}
		}

		calculateVisibleItems()
		let resizeObserver: ResizeObserver | null = null
		const handleResize = () => calculateVisibleItems()
		const hasWindow = typeof window !== 'undefined'
		let addedResizeListener = false

		if (hasWindow && 'ResizeObserver' in window && paginationRef.current) {
			resizeObserver = new ResizeObserver(() => {
				calculateVisibleItems()
			})
			resizeObserver.observe(paginationRef.current)
		} else if (hasWindow) {
			window.addEventListener('resize', handleResize)
			addedResizeListener = true
		}

		return () => {
			resizeObserver?.disconnect()
			if (addedResizeListener) {
				window.removeEventListener('resize', handleResize)
			}
		}
	}, [])

	const totalPages = Math.ceil(items.length / Math.max(1, visibleItems))
	const startPage = Math.floor(startIndex / Math.max(1, visibleItems))
	const maxPage = Math.max(0, totalPages - 1)
	const activeManualPage = pageOverride.startIndex === startIndex ? pageOverride.page : null
	const targetPage = activeManualPage == null ? startPage : activeManualPage
	const currentPage = Math.max(0, Math.min(targetPage, maxPage))

	const startPageTransition = (direction: -1 | 1) => {
		setPageTransition({ direction, entering: true })
		requestAnimationFrame(() => {
			setPageTransition({ direction, entering: false })
		})
	}

	const handlePageChange = (pageIndex: number, direction: -1 | 1) => {
		startPageTransition(direction)
		dispatch({ type: 'SET_PAGE_OVERRIDE', payload: { startIndex, page: pageIndex } })
		dispatch({ type: 'RESET_SWIPE' })
	}

	const handlePrevPage = () => {
		if (totalPages <= 1) {
			dispatch({ type: 'RESET_SWIPE' })
			return
		}
		const newPage = currentPage === 0 ? totalPages - 1 : currentPage - 1
		handlePageChange(newPage, -1)
	}

	const handleNextPage = () => {
		if (totalPages <= 1) {
			dispatch({ type: 'RESET_SWIPE' })
			return
		}
		const newPage = currentPage === totalPages - 1 ? 0 : currentPage + 1
		handlePageChange(newPage, 1)
	}

	const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
		const touch = e.targetTouches[0]
		if (!touch) return
		dispatch({ type: 'TOUCH_START', payload: touch.clientX })
	}

	const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
		if (touchStart === null || !isSwiping) return
		const touch = e.targetTouches[0]
		if (!touch) return
		dispatch({ type: 'TOUCH_MOVE', payload: touch.clientX })
	}

	const onTouchEnd = () => {
		if (touchStart === null || touchEnd === null || !isSwiping) return
		dispatch({ type: 'TOUCH_END' })

		const distance = touchStart - touchEnd
		const isLeftSwipe = distance > minSwipeDistance
		const isRightSwipe = distance < -minSwipeDistance

		requestAnimationFrame(() => {
			dispatch({ type: 'RESET_SWIPE' })
		})

		if (isLeftSwipe) {
			handleNextPage()
		} else if (isRightSwipe) {
			handlePrevPage()
		}
	}

	const startIndexSlice = currentPage * visibleItems
	const endIndexSlice = startIndexSlice + visibleItems
	const currentItems = items.slice(startIndexSlice, endIndexSlice)
	const transitionOffset = pageTransition.entering ? pageTransition.direction * 20 : 0

	const contentStyle = {
		transform: isSwiping ? `translateX(${swipeOffset}px)` : `translateX(${transitionOffset}px)`,
		opacity: isSwiping || !pageTransition.entering ? 1 : 0.84,
		gridTemplateColumns: `repeat(${Math.max(1, currentItems.length)}, minmax(0, 1fr))`
	}
	const contentClassName = `grid w-full gap-2 ${
		isSwiping ? '' : 'transition-all duration-200 ease-out motion-reduce:transition-none'
	}`.trim()
	const paginationClassName =
		totalPages > 1
			? 'relative grid w-full grid-cols-1 items-center gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto]'
			: 'relative grid w-full grid-cols-1 items-center'

	return (
		<>
			<div
				ref={paginationRef}
				className={paginationClassName}
				onTouchStart={onTouchStart}
				onTouchMove={onTouchMove}
				onTouchEnd={onTouchEnd}
			>
				{totalPages > 1 ? (
					<Button
						variant="ghost"
						size="md"
						square
						className="max-md:hidden"
						type="button"
						onClick={handlePrevPage}
						aria-label="Previous page"
					>
						<Icon name="arrow-left" height={16} width={16} />
					</Button>
				) : null}
				<div className="min-w-0 overflow-hidden">
					<div className={contentClassName} style={contentStyle}>
						{/* Callers must key each item by event identity; Children.map preserves those keys on the wrappers. */}
						{Children.map(currentItems, (item) => (
							<div className="relative min-w-0">{item}</div>
						))}
					</div>
				</div>
				{totalPages > 1 ? (
					<Button
						variant="ghost"
						size="md"
						square
						className="max-md:hidden"
						type="button"
						onClick={handleNextPage}
						aria-label="Next page"
					>
						<Icon name="arrow-right" height={16} width={16} />
					</Button>
				) : null}
			</div>

			{totalPages > 1 ? (
				<div className="mt-2 flex items-center justify-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						square
						className="md:hidden"
						type="button"
						onClick={handlePrevPage}
						aria-label="Previous page"
					>
						<Icon name="arrow-left" height={14} width={14} />
					</Button>

					<span className="label-sm text-secondary">
						{currentPage + 1} / {totalPages}
					</span>

					<Button
						variant="ghost"
						size="sm"
						square
						className="md:hidden"
						type="button"
						onClick={handleNextPage}
						aria-label="Next page"
					>
						<Icon name="arrow-right" height={14} width={14} />
					</Button>
				</div>
			) : null}
		</>
	)
}
