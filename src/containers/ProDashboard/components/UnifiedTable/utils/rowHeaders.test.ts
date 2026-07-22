import { describe, expect, it } from 'vitest'
import type { UnifiedRowHeaderType } from '../../../types'
import { DEFAULT_ROW_HEADERS } from '../constants'
import { sanitizeRowHeaders } from './rowHeaders'

describe('sanitizeRowHeaders', () => {
	it('uses canonical defaults for absent and empty persisted headers', () => {
		expect(sanitizeRowHeaders(undefined)).toEqual(DEFAULT_ROW_HEADERS)
		expect(sanitizeRowHeaders([])).toEqual(DEFAULT_ROW_HEADERS)
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

		expect(sanitizeRowHeaders(persisted)).toEqual(['chain', 'category', 'parent-protocol', 'protocol'])
	})

	it('adds protocol after a selected parent protocol', () => {
		expect(sanitizeRowHeaders(['parent-protocol'])).toEqual(['parent-protocol', 'protocol'])
	})
})
