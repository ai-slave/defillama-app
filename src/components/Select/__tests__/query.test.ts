import type { NextRouter } from 'next/router'
import { describe, expect, it, vi } from 'vitest'
import { getQueryUpdatesFromSelected, updateQueryFromSelected } from '../query'

const router = {} as NextRouter

describe('updateQueryFromSelected', () => {
	it('applies page reset before delegating to a custom query updater', () => {
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

	it('does not add page reset when resetPage is false', () => {
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
	it('serializes empty selections as None when the default is not empty', () => {
		expect(getQueryUpdatesFromSelected('include', 'exclude', ['a', 'b'], [], ['a', 'b'])).toEqual({
			include: 'None',
			exclude: undefined
		})
	})

	it('clears params for empty selections when the default is also empty', () => {
		expect(getQueryUpdatesFromSelected('include', 'exclude', ['a', 'b'], [], [])).toEqual({
			include: undefined,
			exclude: undefined
		})
	})
})
