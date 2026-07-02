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

function easeOutQuart(t: number): number {
	return 1 - Math.pow(1 - t, 4)
}

// Animated number: SSR and resting state always render the final value (no hydration
// mismatch); writes textContent directly — no React state churn per frame.
export function useCountUp(value: number, format: (v: number) => string): React.RefObject<HTMLSpanElement | null> {
	const ref = useRef<HTMLSpanElement>(null)
	const seen = useRef(false)
	const shown = useRef(value)
	const raf = useRef(0)
	const fmt = useRef(format)
	fmt.current = format

	useEffect(() => () => cancelAnimationFrame(raf.current), [])

	const animate = (from: number, to: number, ms: number) => {
		const el = ref.current
		if (!el) return
		cancelAnimationFrame(raf.current)
		const start = performance.now()
		const tick = (now: number) => {
			const t = Math.min(1, (now - start) / ms)
			el.textContent = fmt.current(t >= 1 ? to : from + (to - from) * easeOutQuart(t))
			shown.current = to
			if (t < 1) raf.current = requestAnimationFrame(tick)
		}
		raf.current = requestAnimationFrame(tick)
	}

	useEffect(() => {
		const el = ref.current
		if (!el || seen.current || prefersReducedMotion()) return
		if (typeof IntersectionObserver === 'undefined') {
			seen.current = true
			return
		}
		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					io.disconnect()
					seen.current = true
					animate(0, shown.current, 800)
				}
			},
			{ threshold: 0.2 }
		)
		io.observe(el)
		return () => io.disconnect()
	}, [])

	// value changed after the entrance: glide rather than jump.
	useEffect(() => {
		const prev = shown.current
		shown.current = value
		if (seen.current && prev !== value) animate(prev, value, 350)
	}, [value])

	return ref
}
