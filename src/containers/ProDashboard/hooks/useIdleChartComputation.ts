import { useEffect, useLayoutEffect, useRef, useState } from 'react'

interface IdleChartComputationOptions<I, T> {
	enabled: boolean
	signature: string
	/** What the computation reads. Only `signature` schedules work; the inputs current at run time are used. */
	input: I
	compute: (input: I) => T
	emptyValue: T
}

/**
 * Keep large pure chart construction out of React's render phase. The signature
 * identifies the input snapshot; stale idle callbacks are cancelled before they
 * can publish data for a newer selection.
 */
export function useIdleChartComputation<I, T>({
	enabled,
	signature,
	input,
	compute,
	emptyValue
}: IdleChartComputationOptions<I, T>) {
	const latestRef = useRef({ input, compute })
	useLayoutEffect(() => {
		latestRef.current = { input, compute }
	})
	const [computed, setComputed] = useState<{ signature: string; value: T }>({ signature: '', value: emptyValue })

	useEffect(() => {
		if (!enabled) return

		let cancelled = false
		const runComputation = () => {
			if (cancelled) return
			const latest = latestRef.current
			const value = latest.compute(latest.input)
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
