import { useEffect, useRef } from 'react'

// Shared motion utilities: everything is in-view triggered and honors
// prefers-reduced-motion by never firing — the resting state is always complete.

export const EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)'

function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined' || !window.matchMedia) return true
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Fires `onVisible` once, the first time the element enters the viewport; never fires
// under reduced motion.
export function useInViewOnce<T extends HTMLElement>(onVisible: (el: T) => void): React.RefObject<T | null> {
	const ref = useRef<T>(null)
	const cb = useRef(onVisible)
	cb.current = onVisible

	useEffect(() => {
		const el = ref.current
		if (!el || prefersReducedMotion()) return
		if (typeof IntersectionObserver === 'undefined') {
			cb.current(el)
			return
		}
		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					io.disconnect()
					cb.current(el)
				}
			},
			{ threshold: 0.2 }
		)
		io.observe(el)
		return () => io.disconnect()
	}, [])

	return ref
}
