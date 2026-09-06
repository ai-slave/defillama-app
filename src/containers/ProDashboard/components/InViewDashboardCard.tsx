import { type ReactNode, useEffect, useRef, useState } from 'react'
import { EChartsRenderVisibilityProvider } from '~/components/ECharts/renderVisibility'

export const DASHBOARD_CARD_ROOT_MARGIN = '1000px 0px'

type DashboardCardRenderState = 'deferred' | 'visible' | 'mounted-offscreen'

export function InViewDashboardCard({ children, minHeight }: { children: ReactNode; minHeight: number }) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [renderState, setRenderState] = useState<DashboardCardRenderState>('deferred')

	useEffect(() => {
		const element = containerRef.current
		if (!element) return
		if (typeof IntersectionObserver === 'undefined') {
			// oxlint-disable-next-line react/set-state-in-effect -- capability probe: without IntersectionObserver the card mounts after hydration, so the first paint still matches the server's deferred markup.
			setRenderState('visible')
			return
		}

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0]
				if (!entry) return
				setRenderState((current) =>
					entry.isIntersecting ? 'visible' : current === 'deferred' ? current : 'mounted-offscreen'
				)
			},
			{ rootMargin: DASHBOARD_CARD_ROOT_MARGIN }
		)
		observer.observe(element)
		return () => observer.disconnect()
	}, [])
	const hasMounted = renderState !== 'deferred'

	return (
		<div ref={containerRef} aria-busy={!hasMounted} style={{ minHeight }}>
			<EChartsRenderVisibilityProvider visible={renderState === 'visible'}>
				{hasMounted ? children : null}
			</EChartsRenderVisibilityProvider>
		</div>
	)
}
