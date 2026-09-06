import type { NextRouter } from 'next/router'
import { describe, expect, test, vi } from 'vitest'
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
