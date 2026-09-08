import { describe, expect, test } from 'vitest'
import { dialogScrollableBodyStyles, dialogSurfaceStyles } from '../Dialog'

describe('dialog scrolling contract', () => {
	test('keeps overflow on one inner body while the surface clips its chrome', () => {
		expect(dialogSurfaceStyles).toContain('overflow-hidden')
		expect(dialogScrollableBodyStyles).toContain('min-h-0')
		// A content basis, not flex-1: Safari leaves a zero-basis body out of a fit-content dialog's
		// height, so the surface collapses to its chrome.
		expect(dialogScrollableBodyStyles).toContain('flex-auto')
		expect(dialogScrollableBodyStyles).toContain('overflow-y-auto')
	})
})
