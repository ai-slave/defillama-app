import { useEffect, useRef } from 'react'

export function useDashboardConfigFallback(enabled: boolean, refetch: () => unknown) {
	const requestedRef = useRef(false)

	useEffect(() => {
		if (!enabled || requestedRef.current) return
		requestedRef.current = true
		void refetch()
	}, [enabled, refetch])
}
