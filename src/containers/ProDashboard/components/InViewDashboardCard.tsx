import { type ReactNode, useEffect, useRef, useState } from 'react'
import { EChartsRenderVisibilityProvider } from '~/components/ECharts/renderVisibility'

export const DASHBOARD_CARD_ROOT_MARGIN = '1000px 0px'

export function InViewDashboardCard({ children, minHeight }: { children: ReactNode; minHeight: number }) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [isNearViewport, setIsNearViewport] = useState(false)
	const [placeholderHeight, setPlaceholderHeight] = useState(minHeight)

	useEffect(() => {
		const element = containerRef.current
		if (!element) return
		if (typeof IntersectionObserver === 'undefined') {
			setIsNearViewport(true)
			return
		}

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0]
				if (!entry) return
				if (!entry.isIntersecting) {
					setPlaceholderHeight((height) => Math.max(height, Math.ceil(entry.boundingClientRect.height)))
				}
				setIsNearViewport(entry.isIntersecting)
			},
			{ rootMargin: DASHBOARD_CARD_ROOT_MARGIN }
		)
		observer.observe(element)
		return () => observer.disconnect()
	}, [])

	return (
		<div ref={containerRef} aria-busy={!isNearViewport} style={{ minHeight: placeholderHeight }}>
			<EChartsRenderVisibilityProvider visible={isNearViewport}>{children}</EChartsRenderVisibilityProvider>
		</div>
	)
}
