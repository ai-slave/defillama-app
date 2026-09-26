import type { NextRouter } from 'next/router'
import { describe, expect, test, vi } from 'vitest'
import {
	createSelectionMatcher,
	getQueryUpdatesFromSelected,
	readSelectionFromQuery,
	updateQueryFromSelected
} from '../query'

const router = {} as NextRouter

describe('updateQueryFromSelected', () => {
	test('applies page reset before delegating to a custom query updater', () => {
		const pushQueryUpdates = vi.fn()

		updateQueryFromSelected(router, 'include', 'exclude', ['a', 'b'], 'a', undefined, {
			resetPage: true,
			pushQueryUpdates
		})

		expect(pushQueryUpdates).toHaveBeenCalledWith({
			include: 'a',
			exclude: undefined,
			page: undefined
		})
	})

	test('does not add page reset when resetPage is false', () => {
		const pushQueryUpdates = vi.fn()

		updateQueryFromSelected(router, 'include', 'exclude', ['a', 'b'], 'a', undefined, {
			pushQueryUpdates
		})

		expect(pushQueryUpdates).toHaveBeenCalledWith({
			include: 'a',
			exclude: undefined
		})
	})
})

describe('getQueryUpdatesFromSelected', () => {
	test('serializes empty selections as None when the default is not empty', () => {
		expect(getQueryUpdatesFromSelected('include', 'exclude', ['a', 'b'], [], ['a', 'b'])).toEqual({
			include: 'None',
			exclude: undefined
		})
	})

	test('clears params for empty selections when the default is also empty', () => {
		expect(getQueryUpdatesFromSelected('include', 'exclude', ['a', 'b'], [], [])).toEqual({
			include: undefined,
			exclude: undefined
		})
	})
})

describe('non-all selection defaults', () => {
	const all = ['default', 'opt-in', 'other']
	test('keeps selecting everything explicit when one option is the default', () => {
		expect(getQueryUpdatesFromSelected('include', 'exclude', all, null, ['default'])).toEqual({
			include: all,
			exclude: undefined
		})
		expect(getQueryUpdatesFromSelected('include', 'exclude', all, all, ['default'])).toEqual({
			include: all,
			exclude: undefined
		})
	})
	test('writes None when deselecting the last default option', () => {
		expect(getQueryUpdatesFromSelected('include', 'exclude', all, [], ['default'])).toEqual({
			include: 'None',
			exclude: undefined
		})
	})
	test('removes overrides only when the default selection is restored', () => {
		expect(getQueryUpdatesFromSelected('include', 'exclude', all, ['default'], ['default'])).toEqual({
			include: undefined,
			exclude: undefined
		})
		expect(getQueryUpdatesFromSelected('include', 'exclude', all, ['opt-in'], ['default'])).toEqual({
			include: 'opt-in',
			exclude: undefined
		})
	})
})

describe('readSelectionFromQuery', () => {
	const all = ['a', 'b', 'c', 'd', 'e', 'f']
	const read = (query: Record<string, string | Array<string> | undefined>, defaults?: Array<string>) =>
		readSelectionFromQuery(query, 'category', 'excludeCategory', all, defaults)

	// The picker writes whichever list is shorter, so the reader must return the same selection from either key.
	test.each([
		{ picked: null, writes: {}, selected: all },
		{ picked: 'None' as const, writes: { category: 'None' }, selected: [] },
		{ picked: ['b'], writes: { category: 'b' }, selected: ['b'] },
		{ picked: ['a', 'b', 'c'], writes: { category: ['a', 'b', 'c'] }, selected: ['a', 'b', 'c'] },
		{ picked: ['a', 'b', 'c', 'd'], writes: { excludeCategory: ['e', 'f'] }, selected: ['a', 'b', 'c', 'd'] },
		{ picked: ['a', 'b', 'c', 'd', 'e'], writes: { excludeCategory: 'f' }, selected: ['a', 'b', 'c', 'd', 'e'] }
	])('reads back $selected after the picker writes $writes', ({ picked, writes, selected }) => {
		const query = getQueryUpdatesFromSelected('category', 'excludeCategory', all, picked)
		expect(Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined))).toEqual(writes)
		expect(read(query)).toEqual(selected)
	})

	test('returns to every option after Deselect All then Select All', () => {
		const cleared = getQueryUpdatesFromSelected('category', 'excludeCategory', all, 'None')
		expect(read(cleared)).toEqual([])
		const restored = getQueryUpdatesFromSelected('category', 'excludeCategory', all, null)
		expect(read({ ...cleared, ...restored })).toEqual(all)
	})

	test('reads a picker whose default is a subset', () => {
		const defaults = ['a', 'b']
		expect(read({}, defaults)).toEqual(['a', 'b'])
		expect(read({ category: '' }, defaults)).toEqual(['a', 'b'])
		expect(read({ category: 'All' }, defaults)).toEqual(all)
		const everything = getQueryUpdatesFromSelected('category', 'excludeCategory', all, all, defaults)
		expect(read(everything, defaults)).toEqual(all)
	})

	test('selects nothing for None even beside other values', () => {
		expect(read({ category: ['None', 'b'] })).toEqual([])
	})

	test('reads old links: an empty value is the default and All is every option', () => {
		expect(read({ category: '' })).toEqual(all)
		expect(read({ category: 'All', excludeCategory: 'a' })).toEqual(['b', 'c', 'd', 'e', 'f'])
	})

	test('drops values that are not options, and selects nothing when none are left', () => {
		expect(read({ category: ['b', 'dexs', 'a'] })).toEqual(['a', 'b'])
		expect(read({ category: 'dexs' })).toEqual([])
		expect(read({ excludeCategory: ['dexs', 'f'] })).toEqual(['a', 'b', 'c', 'd', 'e'])
	})
})

describe('createSelectionMatcher', () => {
	const all = ['a', 'b', 'c', 'd', 'e', 'f']

	// Servers filter rows with the matcher and never see the option list, so it has to agree with the reader.
	test.each([
		{ query: {} },
		{ query: { category: 'None' } },
		{ query: { category: ['b', 'c'] } },
		{ query: { excludeCategory: ['e', 'f'] } },
		{ query: { category: 'All', excludeCategory: 'a' } },
		{ query: { category: '' } },
		{ query: { category: ['None', 'b'] } }
	])('keeps the options the reader selects for $query', ({ query }) => {
		const matches = createSelectionMatcher(query, 'category', 'excludeCategory')
		const kept = all.filter((option) => (matches ? matches(option) : true))
		expect(kept).toEqual(readSelectionFromQuery(query, 'category', 'excludeCategory', all))
	})

	test('keeps a row with several values when any of them is selected', () => {
		const matches = createSelectionMatcher({ excludeCategory: 'a' }, 'category', 'excludeCategory')!
		expect(['a', 'b'].some(matches)).toBe(true)
		expect(['a'].some(matches)).toBe(false)
	})
})
