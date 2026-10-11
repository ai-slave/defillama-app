import { describe, expect, test } from 'vitest'
import { getSelectOptionLabel } from '../SelectWithCombobox'

const OPTIONS = [
	{ key: 'all', name: 'All' },
	{ key: 'cex', name: 'CEX' },
	{ key: 'dex', name: 'DEX' }
]

describe('SelectWithCombobox trigger values', () => {
	test('shows the authored option label for a single selection', () => {
		expect(getSelectOptionLabel(OPTIONS, 'all')).toBe('All')
	})
})
