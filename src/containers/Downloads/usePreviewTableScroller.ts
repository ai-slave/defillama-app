import { useCallback, useRef } from 'react'
import { useHorizontalOverflow } from '~/hooks/useHorizontalOverflow'

/** The preview table's scroller. The virtualizer reads it through `scrollerRef`; the overflow shadows follow it
    across the remount when a search or date range empties the table. */
export function usePreviewTableScroller() {
	const scrollerRef = useRef<HTMLDivElement>(null)
	const { ref: attachOverflow, canScrollLeft, canScrollRight } = useHorizontalOverflow()
	// Kept stable so React does not detach it every render.
	const setScroller = useCallback(
		(node: HTMLDivElement) => {
			scrollerRef.current = node
			const detachOverflow = attachOverflow(node)
			return () => {
				scrollerRef.current = null
				detachOverflow()
			}
		},
		[attachOverflow]
	)
	return { scrollerRef, setScroller, canScrollLeft, canScrollRight }
}
