import { describe, expect, test, vi } from 'vitest'
import { scrollToFirstUtrClaimError, UTR_CLAIM_ERROR_SELECTOR } from '../scrollToClaimError'

describe('scrollToFirstUtrClaimError', () => {
	test('scrolls the first claim error into view', () => {
		const error = { scrollIntoView: vi.fn() }
		const root = { querySelector: vi.fn().mockReturnValue(error) }

		scrollToFirstUtrClaimError(root as unknown as ParentNode)

		expect(root.querySelector).toHaveBeenCalledWith(UTR_CLAIM_ERROR_SELECTOR)
		expect(error.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
	})

	test('does nothing when the form has no errors', () => {
		const root = { querySelector: vi.fn().mockReturnValue(null) }

		expect(() => scrollToFirstUtrClaimError(root as unknown as ParentNode)).not.toThrow()
	})
})
