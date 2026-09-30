// @vitest-environment happy-dom

import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useForkInitialPrompt } from '../useForkInitialPrompt'

type Props = Parameters<typeof useForkInitialPrompt>[0]

describe('a forked initial prompt', () => {
	let container: HTMLDivElement
	let root: Root
	let frames: Map<number, () => void>
	let nextFrameId: number

	function Harness(props: Props) {
		useForkInitialPrompt(props)
		return null
	}

	const render = (props: Props) =>
		act(async () => {
			root.render(<Harness {...props} />)
		})

	const runFrames = () =>
		act(async () => {
			const pending = [...frames.values()]
			frames.clear()
			for (const frame of pending) frame()
		})

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		frames = new Map()
		nextFrameId = 0
		vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
			nextFrameId += 1
			frames.set(nextFrameId, cb)
			return nextFrameId
		})
		vi.stubGlobal('cancelAnimationFrame', (id: number) => {
			frames.delete(id)
		})
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	})

	const base = (over: Partial<Props> = {}): Props => ({
		initialPrompt: 'fork this',
		routeSessionId: 's1',
		restoringSessionId: null,
		sharedSession: false,
		sessionId: null,
		resolveSessionAlias: (id: string) => id,
		submitPrompt: vi.fn(() => true),
		...over
	})

	test('submits once the target session becomes the current one', async () => {
		const submitPrompt = vi.fn(() => true)
		// Mounted before the session is ready: nothing to submit into yet.
		await render(base({ submitPrompt, sessionId: null }))
		await runFrames()
		expect(submitPrompt).not.toHaveBeenCalled()

		// The session arrives while restoration stays idle, which is the only trigger that changes.
		await render(base({ submitPrompt, sessionId: 's1' }))
		await runFrames()
		expect(submitPrompt).toHaveBeenCalledWith('fork this')
	})

	test('a session change before the frame runs cancels the submission', async () => {
		const submitPrompt = vi.fn(() => true)
		await render(base({ submitPrompt, sessionId: 's1' }))
		// The reader moves to another session before the scheduled frame fires. The fork target is still
		// s1, so this is navigation away from it rather than a new fork.
		await render(base({ submitPrompt, sessionId: 's2' }))
		await runFrames()
		expect(submitPrompt).not.toHaveBeenCalled()
	})

	test('waits for the session restore to finish before submitting', async () => {
		const submitPrompt = vi.fn(() => true)
		await render(base({ submitPrompt, sessionId: 's1', restoringSessionId: 's1' }))
		await runFrames()
		expect(submitPrompt).not.toHaveBeenCalled()

		await render(base({ submitPrompt, sessionId: 's1', restoringSessionId: null }))
		await runFrames()
		expect(submitPrompt).toHaveBeenCalledExactlyOnceWith('fork this')
	})

	test('submits into a shared view when the prompt arrives after the view is ready', async () => {
		const submitPrompt = vi.fn(() => true)
		await render(base({ submitPrompt, sharedSession: true, routeSessionId: null, initialPrompt: undefined }))
		await runFrames()

		await render(base({ submitPrompt, sharedSession: true, routeSessionId: null }))
		await runFrames()
		expect(submitPrompt).toHaveBeenCalledExactlyOnceWith('fork this')
	})

	test('submits once under Strict Mode, which runs each effect twice on mount', async () => {
		const submitPrompt = vi.fn(() => true)
		await act(async () => {
			root.render(
				<StrictMode>
					<Harness {...base({ submitPrompt, sessionId: 's1' })} />
				</StrictMode>
			)
		})
		await runFrames()
		expect(submitPrompt).toHaveBeenCalledExactlyOnceWith('fork this')
	})

	test('a prompt the chat refuses stays pending, and goes out the next time the target is ready', async () => {
		const submitPrompt = vi.fn<(prompt: string) => boolean>().mockReturnValueOnce(false).mockReturnValue(true)
		await render(base({ submitPrompt, sessionId: 's1' }))
		await runFrames()

		await render(base({ submitPrompt, sessionId: 's1', restoringSessionId: 's1' }))
		await render(base({ submitPrompt, sessionId: 's1', restoringSessionId: null }))
		await runFrames()
		expect(submitPrompt.mock.calls).toEqual([['fork this'], ['fork this']])

		await render(base({ submitPrompt, sessionId: 's1', restoringSessionId: 's1' }))
		await render(base({ submitPrompt, sessionId: 's1', restoringSessionId: null }))
		await runFrames()
		expect(submitPrompt).toHaveBeenCalledTimes(2)
	})
})
