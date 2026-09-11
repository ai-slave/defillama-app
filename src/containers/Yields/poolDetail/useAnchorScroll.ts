import { useEffect } from 'react'

/**
 * A panel that mounts after the page (measured props fetched client-side) has already missed the
 * browser's own anchor scroll, so it scrolls itself into view when the URL names it.
 */
export function useAnchorScroll(id: string) {
	useEffect(() => {
		if (window.location.hash === `#${id}`) {
			document.getElementById(id)?.scrollIntoView({ block: 'start' })
		}
	}, [id])
}
