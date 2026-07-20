import { useEffect, useRef, useState } from 'react'

interface IdleChartComputationOptions<T> {
	enabled: boolean
	signature: string
	compute: () => T
	emptyValue: T
}

/**
 * Keep large pure chart construction out of React's render phase. The signature
 * identifies the input snapshot; stale idle callbacks are cancelled before they
 * can publish data for a newer selection.
 */
export function useIdleChartComputation<T>({
	enabled,
	signature,
	compute,
	emptyValue
}: IdleChartComputationOptions<T>) {
	const computeRef = useRef(compute)
	computeRef.current = compute
	const [computed, setComputed] = useState<{ signature: string; value: T }>({ signature: '', value: emptyValue })

	useEffect(() => {
		if (!enabled) return

		let cancelled = false
		const runComputation = () => {
			if (cancelled) return
			const value = computeRef.current()
			if (!cancelled) setComputed({ signature, value })
		}

		let timeoutId: number | undefined
		let idleCallbackId: number | undefined
		if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
			idleCallbackId = window.requestIdleCallback(runComputation, { timeout: 250 })
		} else {
			timeoutId = window.setTimeout(runComputation, 0)
		}

		return () => {
			cancelled = true
			if (idleCallbackId !== undefined && typeof window !== 'undefined') {
				window.cancelIdleCallback(idleCallbackId)
			}
			if (timeoutId !== undefined) window.clearTimeout(timeoutId)
		}
	}, [enabled, signature])

	const hasCurrentValue = enabled && computed.signature === signature
	return {
		value: hasCurrentValue ? computed.value : emptyValue,
		isComputing: enabled && !hasCurrentValue
	}
}
