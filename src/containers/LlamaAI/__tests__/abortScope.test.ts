import { describe, expect, test } from 'vitest'
import { AbortScope } from '~/containers/LlamaAI/abortScope'

describe('AbortScope', () => {
	test('invalidates the old callback before aborting its request', async () => {
		const scope = new AbortScope()
		let currentDuringAbort = true
		const first = scope.run('session-a', async (operation) => {
			await new Promise<void>((resolve) => {
				operation.signal.addEventListener('abort', () => {
					currentDuringAbort = operation.isCurrent()
					resolve()
				})
			})
		})

		const second = scope.run('session-b', async (operation) => {
			expect(operation.isCurrent()).toBe(true)
		})

		await Promise.all([first, second])
		expect(currentDuringAbort).toBe(false)
	})

	test('keeps delayed A and B restores from overwriting the final A route', async () => {
		const scope = new AbortScope()
		const releases: Array<() => void> = []
		const state = { sessionId: '', messages: '', queue: '', attachedSessionId: '' }
		const restore = (sessionId: string, label: string) =>
			scope.run(sessionId, async (operation) => {
				await new Promise<void>((resolve) => releases.push(resolve))
				if (!operation.isCurrent()) return
				state.sessionId = sessionId
				state.messages = `${label}-messages`
				state.queue = `${label}-queue`
				state.attachedSessionId = sessionId
			})

		const firstA = restore('session-a', 'first-a')
		const sessionB = restore('session-b', 'session-b')
		const finalA = restore('session-a', 'final-a')

		releases[1]?.()
		releases[0]?.()
		releases[2]?.()
		await Promise.all([firstA, sessionB, finalA])

		expect(state).toEqual({
			sessionId: 'session-a',
			messages: 'final-a-messages',
			queue: 'final-a-queue',
			attachedSessionId: 'session-a'
		})
	})
})
