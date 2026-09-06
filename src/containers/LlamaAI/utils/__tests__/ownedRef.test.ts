import { createRef } from 'react'
import { describe, expect, test } from 'vitest'
import { createOwnedRef } from '~/containers/LlamaAI/utils/ownedRef'

describe('createOwnedRef', () => {
	test('attaches and detaches a single node', () => {
		const target = createRef<string>()
		const bind = createOwnedRef(target)

		bind('a')
		expect(target.current).toBe('a')

		bind(null)
		expect(target.current).toBe(null)
	})

	test('does not clear the target when a stale binder detaches after another node took over', () => {
		// Two composers briefly coexist (landing-exit copy + conversation composer).
		const target = createRef<string>()
		const bindExitCopy = createOwnedRef(target)
		const bindConversation = createOwnedRef(target)

		bindExitCopy('exit-copy')
		bindConversation('conversation')
		expect(target.current).toBe('conversation')

		// The exit copy unmounts after the animation; the conversation composer must keep the ref.
		bindExitCopy(null)
		expect(target.current).toBe('conversation')

		bindConversation(null)
		expect(target.current).toBe(null)
	})
})
