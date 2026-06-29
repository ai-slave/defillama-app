import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'

type DebouncedFunction<T extends (...args: any[]) => void> = ((...args: Parameters<T>) => void) & {
	cancel: () => void
	flush: () => void
}

const normalizeDelay = (delay: number) => (Number.isFinite(delay) && delay > 0 ? delay : 0)

export function useDebouncedCallback<T extends (...args: any[]) => void>(
	callback: T,
	delay: number
): DebouncedFunction<T> {
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pendingArgsRef = useRef<Parameters<T> | null>(null)
	const normalizedDelay = normalizeDelay(delay)

	const onInvoke = useEffectEvent((args: Parameters<T>) => {
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
	}, [cancel])

	useEffect(() => {
		return cancel
	}, [cancel])

	return useMemo(
		() =>
			Object.assign(
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
				{ cancel, flush }
			),
		[cancel, flush, normalizedDelay]
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
