import { useVirtualizer } from '@tanstack/react-virtual'

export function useVirtualItems<TScrollElement extends Element, TItemElement extends Element = Element>(
	options: Parameters<typeof useVirtualizer<TScrollElement, TItemElement>>[0]
) {
	'use no memo'

	// Virtual keeps its instance stable while mutating its state. Read render values on every render
	// here so compiled callers cannot cache those reads against the instance identity.
	const virtualizer = useVirtualizer(options)
	return {
		items: virtualizer.getVirtualItems(),
		totalSize: virtualizer.getTotalSize(),
		measure: virtualizer.measure,
		scrollToIndex: virtualizer.scrollToIndex
	}
}
