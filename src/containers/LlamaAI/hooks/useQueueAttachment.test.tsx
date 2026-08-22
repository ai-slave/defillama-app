// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkActiveExecution } from '~/containers/LlamaAI/fetchAgenticResponse'
import { useQueueAttachment } from '~/containers/LlamaAI/hooks/useQueueAttachment'
import type { QueuedMessageElement } from '~/containers/LlamaAI/queue/protocol'

vi.mock('~/containers/LlamaAI/fetchAgenticResponse', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/containers/LlamaAI/fetchAgenticResponse')>()),
	checkActiveExecution: vi.fn()
}))

const pending: QueuedMessageElement = {
	id: 'q1',
	state: 'pending',
	message: 'follow up',
	researchMode: false,
	client: 'web',
	queuedAt: '2026-08-21T00:00:00.000Z'
}

describe('useQueueAttachment', () => {
	let container: HTMLDivElement

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.useFakeTimers()
		container = document.createElement('div')
		document.body.appendChild(container)
	})

	afterEach(() => {
		container.remove()
		vi.useRealTimers()
	})

	it('does not re-arm after unmount while a retry delay is pending', async () => {
		vi.mocked(checkActiveExecution).mockResolvedValue({ active: false })
		const root = createRoot(container)
		const getQueue = vi.fn(() => [pending])
		const abortAttachment = vi.fn()

		function Harness() {
			useQueueAttachment({
				sessionId: 'session-1',
				isStreaming: false,
				queue: [pending],
				fetchFn: vi.fn(),
				getQueue,
				applySnapshot: vi.fn(),
				restoreQueue: vi.fn(),
				attachExecution: vi.fn(),
				abortAttachment
			})
			return null
		}

		await act(async () => {
			root.render(<Harness />)
			await Promise.resolve()
		})
		expect(checkActiveExecution).toHaveBeenCalledOnce()

		await act(async () => root.unmount())
		expect(abortAttachment).toHaveBeenCalledOnce()
		await act(async () => vi.advanceTimersByTimeAsync(10_000))

		expect(checkActiveExecution).toHaveBeenCalledOnce()
	})

	it('passes the active queue item identity into a new attachment', async () => {
		vi.mocked(checkActiveExecution)
			.mockResolvedValueOnce({ active: true, queueItemId: 'q1' })
			.mockResolvedValue({ active: false })
		const root = createRoot(container)
		let queue: QueuedMessageElement[] = [pending]
		const attachExecution = vi.fn(async () => {
			queue = []
			return { outcome: 'done' as const, messageId: 'message-1' }
		})

		function Harness() {
			useQueueAttachment({
				sessionId: 'session-1',
				isStreaming: false,
				queue: [pending],
				fetchFn: vi.fn(),
				getQueue: () => queue,
				applySnapshot: vi.fn(),
				restoreQueue: vi.fn(),
				attachExecution,
				abortAttachment: vi.fn()
			})
			return null
		}

		await act(async () => {
			root.render(<Harness />)
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(attachExecution).toHaveBeenCalledWith('session-1', expect.any(Object), true, 'q1')
		await act(async () => root.unmount())
	})
})
