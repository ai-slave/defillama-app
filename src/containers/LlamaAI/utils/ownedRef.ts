import type { RefCallback, RefObject } from 'react'

// React nulls a ref whenever the element bound to it unmounts, even if another
// element has since claimed the same ref object. When two composers briefly
// coexist (e.g. the landing-exit animation copy next to the conversation
// composer), the copy's unmount would detach the live composer's ref and
// silently break auto-grow, focus, and combobox anchoring. This callback ref
// only clears the target if it still points at its own node.
export function createOwnedRef<T>(target: RefObject<T | null>): RefCallback<T> {
	let node: T | null = null
	return (next) => {
		if (next !== null) {
			node = next
			target.current = next
		} else {
			if (target.current === node) target.current = null
			node = null
		}
	}
}
