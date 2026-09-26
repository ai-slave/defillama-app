import type { NextRouter } from 'next/router'
import { describe, expect, test, vi } from 'vitest'
import { parseIncludeExcludeParam } from '~/utils/routerQuery'
import { getQueryUpdatesFromSelected, updateQueryFromSelected } from '../query'

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

describe('parseIncludeExcludeParam', () => {
	const all = ['a', 'b', 'c', 'd', 'e', 'f']

	// The picker writes whichever list is shorter, so the reader must return the same selection from either key.
	test.each([
		{ picked: null, writes: {}, selected: all },
		{ picked: 'None' as const, writes: { category: 'None' }, selected: [] },
		{ picked: ['b'], writes: { category: 'b' }, selected: ['b'] },
		{ picked: ['a', 'b'], writes: { category: ['a', 'b'] }, selected: ['a', 'b'] },
		{ picked: ['a', 'b', 'c'], writes: { category: ['a', 'b', 'c'] }, selected: ['a', 'b', 'c'] },
		{ picked: ['a', 'b', 'c', 'd'], writes: { excludeCategory: ['e', 'f'] }, selected: ['a', 'b', 'c', 'd'] },
		{ picked: ['a', 'b', 'c', 'd', 'e'], writes: { excludeCategory: 'f' }, selected: ['a', 'b', 'c', 'd', 'e'] }
	])('reads back $selected after the picker writes $writes', ({ picked, writes, selected }) => {
		const query = getQueryUpdatesFromSelected('category', 'excludeCategory', all, picked)
		expect(Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined))).toEqual(writes)
		expect(parseIncludeExcludeParam(query.category, query.excludeCategory, all)).toEqual(selected)
	})

	test('treats an empty include value from an old link as nothing selected', () => {
		expect(parseIncludeExcludeParam('', undefined, all)).toEqual([])
	})
})
