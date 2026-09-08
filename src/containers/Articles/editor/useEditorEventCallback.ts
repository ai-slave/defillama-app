import { useCallback, useLayoutEffect, useRef } from 'react'

// Editor events and upload continuations must see committed values before paint.
// Only call the returned callback outside render.
export function useEditorEventCallback<Args extends Array<unknown>, R>(
	callback: (...args: Args) => R
): (...args: Args) => R {
	const ref = useRef(callback)
	useLayoutEffect(() => {
		ref.current = callback
	})
	return useCallback((...args: Args) => ref.current(...args), [])
}
