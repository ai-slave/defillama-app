// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { hasWebChatAttention, isChatSurfaceAttended } from '~/containers/LlamaAI/chatAttention'

describe('chatAttention', () => {
	let visibilityState: DocumentVisibilityState
	let hasFocus: boolean

	beforeEach(() => {
		visibilityState = 'visible'
		hasFocus = true
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => visibilityState
		})
		vi.spyOn(document, 'hasFocus').mockImplementation(() => hasFocus)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	test('is present when the tab is visible and focused', () => {
		expect(hasWebChatAttention()).toBe(true)
		expect(isChatSurfaceAttended({ uncovered: true })).toBe(true)
	})

	test('is absent when the tab is hidden', () => {
		visibilityState = 'hidden'
		hasFocus = false
		expect(hasWebChatAttention()).toBe(false)
		expect(isChatSurfaceAttended({ uncovered: true })).toBe(false)
	})

	test('is absent when the window is visible but unfocused', () => {
		hasFocus = false
		expect(hasWebChatAttention()).toBe(false)
		expect(isChatSurfaceAttended({ uncovered: true })).toBe(false)
	})

	test('is absent when chat chrome covers the conversation', () => {
		expect(isChatSurfaceAttended({ uncovered: false })).toBe(false)
	})
})
