import { describe, expect, it } from 'vitest'
import { getSelectOptionLabel } from '../SelectWithCombobox'

const OPTIONS = [
	{ key: 'all', name: 'All' },
	{ key: 'cex', name: 'CEX' },
	{ key: 'dex', name: 'DEX' }
]

describe('SelectWithCombobox trigger values', () => {
	it('shows the authored option label for a single selection', () => {
		expect(getSelectOptionLabel(OPTIONS, 'all')).toBe('All')
	})

	it('keeps string option labels unchanged', () => {
		expect(getSelectOptionLabel(['All', 'CEX'], 'CEX')).toBe('CEX')
	})
})
