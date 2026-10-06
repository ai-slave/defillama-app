// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { DuelPanel } from '~/containers/LlamaAI/components/DuelPanel'
import type { DuelArmState } from '~/containers/LlamaAI/hooks/useDuelStream'

// Heavy child; the vote controls do not depend on what it renders.
vi.mock('~/containers/LlamaAI/components/messages/MessageBubble', () => ({ MessageBubble: () => null }))

// The tie and both-bad buttons stay focusable once closed, so they mark it with aria-disabled.
const isClosed = (button: HTMLButtonElement) => button.disabled || button.getAttribute('aria-disabled') === 'true'

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
		expect(votes().map(isClosed)).toEqual([false, false, false, false])
		await act(async () => votes()[1].click())
		await act(async () => votes()[1].click())
		expect(onVote.mock.calls).toEqual([['b']])
		expect(votes().map(isClosed)).toEqual([true, true, true, true])
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})

test('a tie vote keeps focus on the button it closed', async () => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	const onVote = vi.fn()
	try {
		await act(async () =>
			root.render(<DuelPanel a={arm} b={arm} sessionId="session-id" isStreaming={false} canResolve onVote={onVote} />)
		)
		const tie = [...container.querySelectorAll('button')].find(
			(button) => button.textContent === 'They’re about the same'
		)!
		tie.focus()
		await act(async () => tie.click())
		expect(onVote.mock.calls).toEqual([['tie']])
		expect(tie.getAttribute('aria-disabled')).toBe('true')
		// Browsers drop focus from a natively disabled button; happy-dom does not, so assert the cause.
		expect(tie.disabled).toBe(false)
		expect(document.activeElement).toBe(tie)
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})
