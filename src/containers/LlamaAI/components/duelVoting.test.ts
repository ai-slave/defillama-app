import { expect, test } from 'vitest'
import type { DuelArmState } from '../hooks/useDuelStream'
import type { Message } from '../types'
import { canVoteOnDuel, hasDuelProgress } from './duelVoting'

const arm = (message: Message, error: string | null = null): DuelArmState => ({
	message,
	messageId: 'message-id',
	isStreaming: false,
	error
})
const prose: Message = { role: 'assistant', content: 'answer' }
const imageOnly: Message = { role: 'assistant', generatedImages: [{ url: 'https://example.com/generated.png' }] }
const toolExecutionOnly: Message = {
	role: 'assistant',
	toolExecutions: [{ name: 'get_protocol', executionTimeMs: 10, success: true }]
}
const toolStepOnly: Message = {
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
}
const reasoningStep: Message = {
	role: 'assistant',
	steps: [{ kind: 'reasoning', id: 'reasoning-0', text: 'The TVL drop is a data gap.' }]
}
const savedThinking: Message = { role: 'assistant', thinking: 'Considered the data gap.' }

test.each([
	['two prose answers', arm(prose), arm(prose), true],
	[
		'an arm that errored after partial content',
		arm({ role: 'assistant', content: 'partial' }, 'Arm failed'),
		arm(prose),
		false
	],
	['the second arm failing after a complete first answer', arm(prose), arm(prose, 'Arm failed'), false],
	['two completed image-only answers', arm(imageOnly), arm(imageOnly), true],
	['tool execution progress without an answer', arm(toolExecutionOnly), arm(prose), false],
	['tool steps without an answer', arm(toolStepOnly), arm(prose), false],
	['a reasoning step and saved thinking', arm(reasoningStep), arm(savedThinking), true]
])('voting on %s', (_name, a, b, expected) => {
	expect(canVoteOnDuel(a, b, false, true)).toBe(expected)
})

test('voting stays closed while the turn streams or before the server confirms both answers', () => {
	expect(canVoteOnDuel(arm(prose), arm(prose), true, true)).toBe(false)
	expect(canVoteOnDuel(arm(prose), arm(prose), false, false)).toBe(false)
})

test('a streaming image-only arm keeps its loading placeholder until the artifact can render', () => {
	expect(hasDuelProgress(imageOnly)).toBe(false)
	expect(hasDuelProgress(toolStepOnly)).toBe(true)
})
