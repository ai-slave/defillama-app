import { describe, expect, test } from 'vitest'
import { resolveExchangeAccessState } from '../ExchangeAccessGate'

describe('resolveExchangeAccessState', () => {
	test('waits for client-side authentication to resolve', () => {
		expect(
			resolveExchangeAccessState({ isClient: false, isLoading: false, isAuthenticated: true, isLlama: true })
		).toBe('loading')
		expect(resolveExchangeAccessState({ isClient: true, isLoading: true, isAuthenticated: true, isLlama: true })).toBe(
			'loading'
		)
	})

	test('authorizes only authenticated llama users', () => {
		expect(resolveExchangeAccessState({ isClient: true, isLoading: false, isAuthenticated: true, isLlama: true })).toBe(
			'authorized'
		)
	})

	test.each([
		{ isAuthenticated: false, isLlama: false },
		{ isAuthenticated: false, isLlama: true },
		{ isAuthenticated: true, isLlama: false }
	])('shows not found for unauthorized users: %o', ({ isAuthenticated, isLlama }) => {
		expect(resolveExchangeAccessState({ isClient: true, isLoading: false, isAuthenticated, isLlama })).toBe('not-found')
	})
})
