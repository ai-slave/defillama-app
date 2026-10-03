import type * as ReactVirtual from '@tanstack/react-virtual'

/** Scrolls the stubbed list to `offset`, as a user scrolling it would. */
export const virtualViewport = { scroll: (_offset: number, _isScrolling?: boolean) => {} }

/**
 * happy-dom has no layout, so a virtualized list measures 0px and renders no rows. This keeps the real
 * virtualizer and stands in for the layout: a 280px list whose measured rows are 36px tall. `vi.mock` runs
 * before the test file's imports, so the factory imports this module itself:
 *
 * vi.mock('@tanstack/react-virtual', async (original) =>
 * 	(await import('~/utils/testing/virtualLayout')).withVirtualLayout(await original())
 * )
 */
export function withVirtualLayout(actual: typeof ReactVirtual): typeof ReactVirtual {
	return {
		...actual,
		useVirtualizer: (options) =>
			actual.useVirtualizer({
				...options,
				observeElementRect: (_, callback) => {
					callback({ width: 300, height: 280 })
					return () => {}
				},
				observeElementOffset: (_, callback) => {
					virtualViewport.scroll = (offset, isScrolling = true) => callback(offset, isScrolling)
					callback(0, false)
					return () => {}
				},
				scrollToFn: (offset) => virtualViewport.scroll(offset, false),
				measureElement: () => 36
			})
	}
}
