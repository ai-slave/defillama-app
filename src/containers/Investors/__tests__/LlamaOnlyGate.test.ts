import { describe, expect, test } from 'vitest'
import { resolveLlamaOnlyGateState } from '../LlamaOnlyGate'

describe('resolveLlamaOnlyGateState', () => {
	test('a public dashboard is always authorized', () => {
		expect(resolveLlamaOnlyGateState({ enabled: false, isClient: false, isLoading: true, isLlama: false })).toBe(
			'authorized'
		)
	})

	test('a llama user is authorized as soon as the flag is known', () => {
		expect(resolveLlamaOnlyGateState({ enabled: true, isClient: true, isLoading: false, isLlama: true })).toBe(
			'authorized'
		)
	})

	test('waits for the client and the user record before deciding', () => {
		expect(resolveLlamaOnlyGateState({ enabled: true, isClient: false, isLoading: false, isLlama: false })).toBe(
			'loading'
		)
		expect(resolveLlamaOnlyGateState({ enabled: true, isClient: true, isLoading: true, isLlama: false })).toBe(
			'loading'
		)
	})

	test('redirects a resolved non-llama user', () => {
		expect(resolveLlamaOnlyGateState({ enabled: true, isClient: true, isLoading: false, isLlama: false })).toBe(
			'redirect'
		)
	})
})
