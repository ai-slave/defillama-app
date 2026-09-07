// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useForkInitialPrompt } from '../useForkInitialPrompt'

type Props = Parameters<typeof useForkInitialPrompt>[0]

describe('a forked initial prompt', () => {
	let container: HTMLDivElement
	let root: Root
	let frames: Array<() => void>

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
			const pending = frames
			frames = []
			for (const frame of pending) frame()
		})

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		frames = []
		vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
			frames.push(cb)
			return frames.length
		})
		vi.stubGlobal('cancelAnimationFrame', (id: number) => {
			frames[id - 1] = () => {}
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
		submitPrompt: vi.fn(),
		...over
	})

	test('submits once the target session becomes the current one', async () => {
		const submitPrompt = vi.fn()
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
		const submitPrompt = vi.fn()
		await render(base({ submitPrompt, sessionId: 's1' }))
		// The reader moves to another session before the scheduled frame fires. The fork target is still
		// s1, so this is navigation away from it rather than a new fork.
		await render(base({ submitPrompt, sessionId: 's2' }))
		await runFrames()
		expect(submitPrompt).not.toHaveBeenCalled()
	})
})
