import { describe, expect, test } from 'vitest'
import { getCommaSeparatedQueryParam, getFirstQueryParam } from '../query'

describe('page data query helpers', () => {
	test('returns the first query param value', () => {
		expect(getFirstQueryParam(['first', 'second'])).toBe('first')
		expect(getFirstQueryParam('only')).toBe('only')
		expect(getFirstQueryParam(undefined)).toBeUndefined()
	})

	test('returns an empty list for missing comma-separated query params', () => {
		expect(getCommaSeparatedQueryParam(undefined)).toEqual([])
	})

	test('parses comma-separated query params', () => {
		expect(getCommaSeparatedQueryParam('staking, borrowed,,pool2')).toEqual(['staking', 'borrowed', 'pool2'])
	})

	test('flattens repeated comma-separated query params', () => {
		expect(getCommaSeparatedQueryParam(['staking, borrowed', ',pool2'])).toEqual(['staking', 'borrowed', 'pool2'])
	})
})
