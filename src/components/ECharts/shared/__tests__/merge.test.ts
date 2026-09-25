import { describe, expect, test } from 'vitest'
import { mergeDeep } from '../merge'

describe('mergeDeep', () => {
	test('merges flat objects', () => {
		expect(mergeDeep({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
	})

	test('overwrites primitive values', () => {
		expect(mergeDeep({ a: 1 }, { a: 2 })).toEqual({ a: 2 })
	})

	test('recursively merges nested objects', () => {
		expect(mergeDeep({ a: { x: 1 } }, { a: { y: 2 } })).toEqual({ a: { x: 1, y: 2 } })
	})

	test('concatenates top-level arrays', () => {
		expect(mergeDeep([1, 2], [3, 4])).toEqual([1, 2, 3, 4])
	})

	test('overwrites nested arrays (no deep concat)', () => {
		expect(mergeDeep({ a: [1, 2] }, { a: [3, 4] })).toEqual({ a: [3, 4] })
	})

	test('returns target when source is null or undefined', () => {
		expect(mergeDeep({ a: 1 }, null)).toEqual({ a: 1 })
		expect(mergeDeep({ a: 1 }, undefined)).toEqual({ a: 1 })
	})
})
