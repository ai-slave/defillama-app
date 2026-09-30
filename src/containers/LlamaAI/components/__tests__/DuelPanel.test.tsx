// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { DuelPanel } from '~/containers/LlamaAI/components/DuelPanel'
import type { DuelArmState } from '~/containers/LlamaAI/hooks/useDuelStream'

// Heavy child; the vote controls do not depend on what it renders.
vi.mock('~/containers/LlamaAI/components/messages/MessageBubble', () => ({ MessageBubble: () => null }))

const arm: DuelArmState = {
	message: { role: 'assistant', content: 'answer' },
	messageId: 'message-id',
	answered: true,
	error: null
}

test('a vote is recorded once and closes every vote control', async () => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	const onVote = vi.fn()
	const votes = () =>
		[...container.querySelectorAll('button')].filter((button) =>
			['I prefer Response 1', 'I prefer Response 2', 'They’re about the same', 'Neither is good'].some(
				(label) => button.getAttribute('aria-label') === label || button.textContent?.trim() === label
			)
		)
	try {
		await act(async () =>
			root.render(<DuelPanel a={arm} b={arm} sessionId="session-id" isStreaming={false} canResolve onVote={onVote} />)
		)
		expect(votes().map((button) => button.disabled)).toEqual([false, false, false, false])
		await act(async () => votes()[1].click())
		await act(async () => votes()[1].click())
		expect(onVote.mock.calls).toEqual([['b']])
		expect(votes().map((button) => button.disabled)).toEqual([true, true, true, true])
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})
