import { describe, expect, test } from 'vitest'
import { sanitizeUnifiedTableRowHeaders } from '../layoutPolicy'
import type { UnifiedRowHeaderType } from '../types'

describe('sanitizeUnifiedTableRowHeaders', () => {
	test('uses canonical defaults for absent and empty persisted headers', () => {
		expect(sanitizeUnifiedTableRowHeaders(undefined)).toEqual(['parent-protocol', 'protocol'])
		expect(sanitizeUnifiedTableRowHeaders([])).toEqual(['parent-protocol', 'protocol'])
	})

	test('removes invalid and duplicate headers while keeping protocol last', () => {
		const persisted = [
			'protocol',
			'chain',
			'chain',
			'unknown',
			'parent-protocol',
			'category',
			'protocol'
		] as Array<UnifiedRowHeaderType>

		expect(sanitizeUnifiedTableRowHeaders(persisted)).toEqual(['chain', 'category', 'parent-protocol', 'protocol'])
	})

	test('adds protocol after a selected parent protocol', () => {
		expect(sanitizeUnifiedTableRowHeaders(['parent-protocol'])).toEqual(['parent-protocol', 'protocol'])
	})
})
