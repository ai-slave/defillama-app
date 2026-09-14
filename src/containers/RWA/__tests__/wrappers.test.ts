import { describe, expect, test } from 'vitest'
import { areWrappersIncludedByDefault } from '../wrappers'

describe('areWrappersIncludedByDefault', () => {
	test('keeps wrappers in on the pages that are about them', () => {
		for (const categorySlug of ['other-rwas', 'rwa-wrappers', 'rwa-yield-wrapper']) {
			expect(areWrappersIncludedByDefault('category', categorySlug)).toBe(true)
		}
		expect(areWrappersIncludedByDefault('platform')).toBe(true)
		expect(areWrappersIncludedByDefault('assetGroup')).toBe(true)
	})

	test('keeps wrappers out elsewhere, so a wrapped asset is not counted twice', () => {
		expect(areWrappersIncludedByDefault('category', 'private-credit')).toBe(false)
		expect(areWrappersIncludedByDefault('chain')).toBe(false)
	})
})
