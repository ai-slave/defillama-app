import { describe, expect, it } from 'vitest'
import { DEFAULT_UNIFIED_TABLE_ROW_HEADERS, sanitizeUnifiedTableRowHeaders } from './layoutPolicy'
import type { UnifiedRowHeaderType } from './types'

describe('sanitizeUnifiedTableRowHeaders', () => {
	it('uses canonical defaults for absent and empty persisted headers', () => {
		expect(sanitizeUnifiedTableRowHeaders(undefined)).toEqual(DEFAULT_UNIFIED_TABLE_ROW_HEADERS)
		expect(sanitizeUnifiedTableRowHeaders([])).toEqual(DEFAULT_UNIFIED_TABLE_ROW_HEADERS)
	})

	it('removes invalid and duplicate headers while keeping protocol last', () => {
		const persisted = [
			'protocol',
			'chain',
			'chain',
			'unknown',
			'parent-protocol',
			'category',
			'protocol'
		] as UnifiedRowHeaderType[]

		expect(sanitizeUnifiedTableRowHeaders(persisted)).toEqual(['chain', 'category', 'parent-protocol', 'protocol'])
	})

	it('adds protocol after a selected parent protocol', () => {
		expect(sanitizeUnifiedTableRowHeaders(['parent-protocol'])).toEqual(['parent-protocol', 'protocol'])
	})
})
