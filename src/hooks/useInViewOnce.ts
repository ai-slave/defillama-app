import { useCallback, useState } from 'react'

/**
 * Reports once the element comes within `rootMargin` of the viewport and keeps reporting it after it scrolls away,
 * so lazy content stays mounted. `onSeen` runs at that moment, from the observer, so an impression fires once;
 * pass a stable callback.
 */
export function useInViewOnce({ rootMargin, onSeen }: { rootMargin?: string; onSeen?: () => void } = {}) {
	const [seen, setSeen] = useState(false)
	const ref = useCallback(
		(element: Element | null) => {
			if (!element || seen) return
			const observer = new IntersectionObserver(
				(entries) => {
					if (!entries.some((entry) => entry.isIntersecting)) return
					observer.disconnect()
					setSeen(true)
					onSeen?.()
				},
				{ rootMargin }
			)
			observer.observe(element)
			return () => observer.disconnect()
		},
		[rootMargin, seen, onSeen]
	)
	return { ref, seen }
}
