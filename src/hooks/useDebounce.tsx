import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStableCallback } from '~/hooks/useStableCallback'

type DebouncedFunction<T extends (...args: Array<any>) => void> = ((...args: Parameters<T>) => void) & {
	cancel: () => void
	flush: () => void
}

const normalizeDelay = (delay: number) => (Number.isFinite(delay) && delay > 0 ? delay : 0)

export function useDebouncedCallback<T extends (...args: Array<any>) => void>(
	callback: T,
	delay: number
): DebouncedFunction<T> {
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pendingArgsRef = useRef<Parameters<T> | null>(null)
	const normalizedDelay = normalizeDelay(delay)

	const onInvoke = useStableCallback((args: Parameters<T>) => {
		callback(...args)
	})

	const cancel = useCallback(() => {
		if (timeoutRef.current != null) {
			clearTimeout(timeoutRef.current)
			timeoutRef.current = null
		}
		pendingArgsRef.current = null
	}, [])

	const flush = useCallback(() => {
		const pendingArgs = pendingArgsRef.current
		cancel()
		if (pendingArgs != null) onInvoke(pendingArgs)
	}, [cancel, onInvoke])

	useEffect(() => {
		return cancel
	}, [cancel])

	// The debounced callable and its cancel/flush handles own the pending-args and timer refs. Callers
	// invoke them from event handlers and effects, never while rendering, so no render output depends on
	// a ref's value here.
	return useMemo(
		() =>
			Object.assign(
				// oxlint-disable-next-line react/refs -- see above
				((...args: Parameters<T>) => {
					cancel()
					pendingArgsRef.current = args
					timeoutRef.current = setTimeout(() => {
						const pendingArgs = pendingArgsRef.current
						timeoutRef.current = null
						pendingArgsRef.current = null
						if (pendingArgs != null) onInvoke(pendingArgs)
					}, normalizedDelay)
				}) as DebouncedFunction<T>,
				// oxlint-disable-next-line react/refs -- see above
				{ cancel, flush }
			),
		[cancel, flush, normalizedDelay, onInvoke]
	)
}

export function useDebouncedValue<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState(() => value)
	const normalizedDelay = normalizeDelay(delay)

	useEffect(() => {
		const timeoutId = setTimeout(() => {
			setDebouncedValue(value)
		}, normalizedDelay)

		return () => {
			clearTimeout(timeoutId)
		}
	}, [value, normalizedDelay])

	return debouncedValue
}
