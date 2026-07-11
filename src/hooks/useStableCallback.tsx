import { useCallback, useEffect, useRef } from 'react'

/** Stable-identity wrapper that always invokes the latest `callback`.
    The ref-based stand-in for the "useEffectEvent as stable callback"
    pattern: effect events may only be called from Effects in the same
    component (react-hooks/rules-of-hooks), so callbacks that escape into
    timers, cleanup callbacks, or other hooks use this instead. Not safe
    to call during render. */
export function useStableCallback<Args extends unknown[], R>(callback: (...args: Args) => R): (...args: Args) => R {
	const ref = useRef(callback)
	useEffect(() => {
		ref.current = callback
	})
	return useCallback((...args: Args) => ref.current(...args), [])
}
