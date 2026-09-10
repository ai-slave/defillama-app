// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DuelPanel } from '~/containers/LlamaAI/components/DuelPanel'
import type { DuelArmState } from '~/containers/LlamaAI/hooks/useDuelStream'
import type { Message } from '~/containers/LlamaAI/types'

vi.mock('~/containers/LlamaAI/components/messages/MessageBubble', () => ({ MessageBubble: () => null }))
vi.mock('~/ui/Icon', () => ({ Icon: () => null }))

function arm(message: Message, error: string | null = null): DuelArmState {
	return { message, messageId: 'message-id', isStreaming: false, error }
}

function answer(content = 'answer'): Message {
	return { role: 'assistant', content }
}

describe('DuelPanel voting eligibility', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	async function render(a: DuelArmState, b: DuelArmState) {
		await act(async () => {
			root.render(<DuelPanel a={a} b={b} sessionId="session-id" isStreaming={false} canResolve onVote={vi.fn()} />)
		})
		const getButton = (label: string) => {
			const button = Array.from(container.querySelectorAll('button')).find(
				(candidate) => candidate.getAttribute('aria-label') === label || candidate.textContent?.trim() === label
			)
			if (!button) throw new Error(`Missing vote button: ${label}`)
			return button
		}
		return [
			getButton('I prefer Response 1'),
			getButton('I prefer Response 2'),
			getButton('They’re about the same'),
			getButton('Neither is good')
		]
	}

	test('does not allow voting when an arm errors after producing partial content', async () => {
		const buttons = await render(arm(answer('partial answer'), 'Arm failed'), arm(answer()))

		expect(buttons.every((button) => button.disabled)).toBe(true)
	})

	test('allows voting for completed artifact-only answers', async () => {
		const artifactAnswer: Message = {
			role: 'assistant',
			generatedImages: [{ url: 'https://example.com/generated.png' }]
		}
		const buttons = await render(arm(artifactAnswer), arm(artifactAnswer))

		expect(buttons.every((button) => !button.disabled)).toBe(true)
	})

	test('keeps the loading placeholder until an out-of-band artifact can render', async () => {
		const artifactAnswer: Message = {
			role: 'assistant',
			generatedImages: [{ url: 'https://example.com/generated.png' }]
		}

		await render({ ...arm(artifactAnswer), isStreaming: true }, arm(answer()))

		const status = container.querySelector('[role="status"]')
		expect(status?.textContent).toContain('Waiting for Response 1')
	})

	test('does not treat tool execution progress as an answer', async () => {
		const toolOnlyMessage = {
			role: 'assistant',
			toolExecutions: [{ name: 'get_protocol', executionTimeMs: 10, success: true }]
		} satisfies Message
		const buttons = await render(arm(toolOnlyMessage), arm(answer()))

		expect(buttons.every((button) => button.disabled)).toBe(true)
	})

	test('does not treat tool steps as an answer either', async () => {
		const toolStepsOnly = {
			role: 'assistant',
			steps: [
				{
					kind: 'tool',
					id: 'c1',
					toolCallId: 'c1',
					name: 'execute_sql',
					label: 'Querying database',
					params: null,
					status: 'done',
					execution: { name: 'execute_sql', executionTimeMs: 10, success: true }
				}
			]
		} satisfies Message
		const buttons = await render(arm(toolStepsOnly), arm(answer()))

		expect(buttons.every((button) => button.disabled)).toBe(true)
	})

	test('counts reasoning steps and saved thinking as answers', async () => {
		const reasoned = {
			role: 'assistant',
			steps: [{ kind: 'reasoning', id: 'reasoning-0', text: 'The TVL drop is a data gap.' }]
		} satisfies Message
		const saved = { role: 'assistant', thinking: 'Considered the data gap.' } satisfies Message
		const buttons = await render(arm(reasoned), arm(saved))

		expect(buttons.every((button) => !button.disabled)).toBe(true)
	})
})
