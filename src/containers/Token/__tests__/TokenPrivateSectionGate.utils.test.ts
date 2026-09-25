import { describe, expect, test } from 'vitest'
import { getTokenPrivateSectionView } from '../TokenPrivateSectionGate.utils'

const subscriber = {
	isAuthenticated: true,
	hasActiveSubscription: true,
	isLoading: false,
	hasError: false,
	hasEmptyMessage: false
}

describe('getTokenPrivateSectionView', () => {
	test('shows subscribers the section content', () => {
		expect(getTokenPrivateSectionView(subscriber)).toBe('content')
	})

	test('waits for auth and data before deciding access', () => {
		expect(getTokenPrivateSectionView({ ...subscriber, isAuthenticated: false, isLoading: true })).toBe('loading')
	})

	test('asks signed-out readers to sign in and signed-in non-subscribers to subscribe', () => {
		expect(getTokenPrivateSectionView({ ...subscriber, isAuthenticated: false, hasActiveSubscription: false })).toBe(
			'sign-in'
		)
		expect(getTokenPrivateSectionView({ ...subscriber, hasActiveSubscription: false })).toBe('subscribe')
	})

	test('never reveals a fetch error or empty state to readers without access', () => {
		expect(
			getTokenPrivateSectionView({ ...subscriber, hasActiveSubscription: false, hasError: true, hasEmptyMessage: true })
		).toBe('subscribe')
	})

	test('shows subscribers a fetch error before an empty state', () => {
		expect(getTokenPrivateSectionView({ ...subscriber, hasError: true, hasEmptyMessage: true })).toBe('error')
		expect(getTokenPrivateSectionView({ ...subscriber, hasEmptyMessage: true })).toBe('empty')
	})
})
