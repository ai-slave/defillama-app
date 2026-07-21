import { describe, expect, it } from 'vitest'
import { mergeDeep } from './merge'

describe('mergeDeep', () => {
	it('merges flat objects', () => {
		expect(mergeDeep({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
	})

	it('overwrites primitive values', () => {
		expect(mergeDeep({ a: 1 }, { a: 2 })).toEqual({ a: 2 })
	})

	it('recursively merges nested objects', () => {
		expect(mergeDeep({ a: { x: 1 } }, { a: { y: 2 } })).toEqual({ a: { x: 1, y: 2 } })
	})

	it('concatenates top-level arrays', () => {
		expect(mergeDeep([1, 2], [3, 4])).toEqual([1, 2, 3, 4])
	})

	it('overwrites nested arrays (no deep concat)', () => {
		expect(mergeDeep({ a: [1, 2] }, { a: [3, 4] })).toEqual({ a: [3, 4] })
	})

	it('returns target when source is null or undefined', () => {
		expect(mergeDeep({ a: 1 }, null)).toEqual({ a: 1 })
		expect(mergeDeep({ a: 1 }, undefined)).toEqual({ a: 1 })
	})

	it('overwrites with primitive source', () => {
		expect(mergeDeep({ a: 1 }, 42)).toBe(42)
	})

	it('handles deeply nested merge', () => {
		expect(mergeDeep({ a: { b: { c: 1 } } }, { a: { b: { d: 2 } } })).toEqual({
			a: { b: { c: 1, d: 2 } }
		})
	})
})
