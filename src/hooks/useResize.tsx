import { useCallback, useState } from 'react'

export const useResize = (elementRef: React.RefObject<HTMLDivElement | null>) => {
	const [width, setWidth] = useState(0)
	const ref = useCallback(
		(element: HTMLDivElement | null) => {
			elementRef.current = element
			if (!element) return

			const measure = () => setWidth(element.offsetWidth)
			measure()
			const observer = new ResizeObserver(measure)
			observer.observe(element, { box: 'border-box' })
			return () => {
				observer.disconnect()
				elementRef.current = null
			}
		},
		[elementRef]
	)

	return { width, ref }
}
