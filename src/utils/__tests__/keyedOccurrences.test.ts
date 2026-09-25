import { expect, test } from 'vitest'
import { keyedOccurrences } from '../keyedOccurrences'

test('keeps entity keys through reorder, insertion, deletion, and changing values', () => {
	const a = { id: 'a', value: 1 },
		b = { id: 'b', value: 2 }
	const original = keyedOccurrences([a, b], (row) => row.id)
	const next = keyedOccurrences([{ id: 'new', value: 0 }, { ...b, value: 3 }, a], (row) => row.id)
	expect(next[1].key).toBe(original[1].key)
	expect(next[2].key).toBe(original[0].key)
	expect(keyedOccurrences([b], (row) => row.id)[0].key).toBe(original[1].key)
	expect(original[0].item).toBe(a)
})

test('retains duplicate and blank occurrences without ambiguous concatenation', () => {
	const values = ['', '', 'a1', 'a', 'a', '["a",0]', 'a:1']
	const keyed = keyedOccurrences(values, (value) => value)
	expect(keyed.map((row) => row.item)).toEqual(values)
	expect(new Set(keyed.map((row) => row.key)).size).toBe(values.length)
	expect(keyedOccurrences(['a', 'a'], (value) => value).map((row) => row.key)).toEqual([keyed[3].key, keyed[4].key])
	expect(keyedOccurrences([], (value) => value)).toEqual([])
})
