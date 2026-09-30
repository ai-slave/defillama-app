// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useAnswerAttention } from '~/containers/LlamaAI/hooks/useAnswerAttention'
import { installUmamiSink } from '~/utils/testing/umamiSink'

const track = installUmamiSink()

const state = { isStreaming: false, hasText: false, entrySource: 'chat' as string | undefined }

function Harness() {
	useAnswerAttention(state)
	return null
}

function setVisibility(value: 'visible' | 'hidden') {
	Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
	document.dispatchEvent(new Event('visibilitychange'))
}

function events() {
	return track.mock.calls.map(([name, data]) => ({ name, data }))
}

describe('useAnswerAttention', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.useFakeTimers()
		state.isStreaming = false
		state.hasText = false
		state.entrySource = 'chat'
		setVisibility('visible')
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.useRealTimers()
	})

	async function render() {
		await act(async () => root.render(<Harness />))
	}

	test('records a seen answer with how long the user waited, so bounce can be compared by wait time', async () => {
		state.entrySource = 'newsletter'
		await render()
		state.isStreaming = true
		await render()
		vi.advanceTimersByTime(12_000)
		state.isStreaming = false
		await render()

		expect(events()).toEqual([
			{ name: 'llamaai-answer-view', data: { entry_source: 'newsletter', wait_ms: 12_000, returned: false } }
		])
	})

	test('records a bounce before any text when the tab goes away mid-wait', async () => {
		await render()
		state.isStreaming = true
		await render()
		vi.advanceTimersByTime(8000)
		act(() => setVisibility('hidden'))

		expect(events()).toEqual([
			{
				name: 'llamaai-answer-abandon',
				data: { entry_source: 'chat', waited_ms: 8000, phase: 'before_first_token' }
			}
		])
	})

	test('marks a user who left and came back before the end as returned, not as a clean view', async () => {
		await render()
		state.isStreaming = true
		state.hasText = true
		await render()
		act(() => setVisibility('hidden'))
		act(() => setVisibility('hidden'))
		act(() => setVisibility('visible'))
		state.isStreaming = false
		await render()

		expect(events().map((e) => e.name)).toEqual(['llamaai-answer-abandon', 'llamaai-answer-view'])
		expect(events()[0].data).toMatchObject({ phase: 'streaming' })
		expect(events()[1].data).toMatchObject({ returned: true })
	})

	test('does not count an answer that finished while the tab was hidden as seen', async () => {
		await render()
		state.isStreaming = true
		await render()
		act(() => setVisibility('hidden'))
		state.isStreaming = false
		await render()

		expect(events().map((e) => e.name)).toEqual(['llamaai-answer-abandon'])
	})
})
