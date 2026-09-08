import { useEffect, useMemo, useRef, useState } from 'react'
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

	// Every handle is a stable callback rather than a useCallback so the timer and pending-args refs stay
	// inside this hook. Handing the compiler a function it can see touching a ref is what it rejects, even
	// when -- as here -- callers only ever invoke these from event handlers, timers and effects.
	const cancel = useStableCallback(() => {
		if (timeoutRef.current != null) {
			clearTimeout(timeoutRef.current)
			timeoutRef.current = null
		}
		pendingArgsRef.current = null
	})

	const flush = useStableCallback(() => {
		const pendingArgs = pendingArgsRef.current
		cancel()
		if (pendingArgs != null) onInvoke(pendingArgs)
	})

	const schedule = useStableCallback((args: Parameters<T>) => {
		cancel()
		pendingArgsRef.current = args
		timeoutRef.current = setTimeout(() => {
			const pendingArgs = pendingArgsRef.current
			timeoutRef.current = null
			pendingArgsRef.current = null
			if (pendingArgs != null) onInvoke(pendingArgs)
		}, normalizedDelay)
	})

	useEffect(() => {
		return cancel
	}, [cancel])

	return useMemo(
		() => Object.assign(((...args: Parameters<T>) => schedule(args)) as DebouncedFunction<T>, { cancel, flush }),
		[cancel, flush, schedule]
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
