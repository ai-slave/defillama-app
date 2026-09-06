import * as React from 'react'

export function useLazyVisible<T extends HTMLElement>(rootMargin = '400px') {
	const ref = React.useRef<T | null>(null)
	const [visible, setVisible] = React.useState(false)

	React.useEffect(() => {
		if (visible) return
		const node = ref.current
		if (!node) return
		if (typeof IntersectionObserver === 'undefined') {
			// Capability probe: without IntersectionObserver the content mounts after hydration, so the first
			// paint still matches the server's markup.
			// oxlint-disable-next-line react/set-state-in-effect -- see above
			setVisible(true)
			return
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return
				setVisible(true)
				observer.disconnect()
			},
			{ rootMargin }
		)
		observer.observe(node)
		return () => observer.disconnect()
	}, [rootMargin, visible])

	return { ref, visible }
}
