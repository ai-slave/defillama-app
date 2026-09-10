/** Read at interaction time so preference changes need no React state or subscription. */
export function getScrollBehavior(): ScrollBehavior {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
}
