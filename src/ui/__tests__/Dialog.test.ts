import { describe, expect, it } from 'vitest'
import { dialogScrollableBodyStyles, dialogSurfaceStyles } from '../Dialog'

describe('dialog scrolling contract', () => {
	it('keeps overflow on one inner body while the surface clips its chrome', () => {
		expect(dialogSurfaceStyles).toContain('overflow-hidden')
		expect(dialogScrollableBodyStyles).toContain('min-h-0')
		expect(dialogScrollableBodyStyles).toContain('flex-1')
		expect(dialogScrollableBodyStyles).toContain('overflow-y-auto')
	})
})
