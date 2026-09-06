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
