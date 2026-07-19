import { describe, expect, it } from 'vitest'
import { formatNullablePercent } from './ui'

describe('Odyssey UI formatters', () => {
	it('renders missing percentages as an em dash', () => {
		expect(formatNullablePercent(null)).toBe('—')
	})

	it('renders numeric percentages without changing their precision', () => {
		expect(formatNullablePercent(12.5)).toBe('12.5%')
	})
})
