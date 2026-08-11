// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { scrollToPageTop } from './scrollToPageTop'

describe('scrollToPageTop', () => {
	afterEach(() => vi.restoreAllMocks())

	it('resets the document scroll position', () => {
		const scrollTo = vi.spyOn(window, 'scrollTo')

		scrollToPageTop()

		expect(scrollTo).toHaveBeenCalledWith(0, 0)
	})
})
