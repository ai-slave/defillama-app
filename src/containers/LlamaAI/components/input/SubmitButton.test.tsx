// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SubmitButton } from '~/containers/LlamaAI/components/input/SubmitButton'

describe('SubmitButton streaming affordances', () => {
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

	test('shows only Stop when queueing is unavailable', async () => {
		await act(async () => {
			root.render(<SubmitButton mode={{ kind: 'streaming', canQueue: false, onStop: vi.fn() }} />)
		})

		expect(container.textContent).toContain('Stop')
		expect(container.textContent).not.toContain('Queue message')
	})

	test('shows Queue beside Stop when queueing is available', async () => {
		await act(async () => {
			root.render(<SubmitButton mode={{ kind: 'streaming', canQueue: true, onStop: vi.fn() }} />)
		})

		expect(container.textContent).toContain('Stop')
		expect(container.textContent).toContain('Queue message')
	})

	test('blocks queue and duplicate stop actions until stopping is confirmed', async () => {
		await act(async () => {
			root.render(<SubmitButton mode={{ kind: 'stopping' }} />)
		})

		expect(container.textContent).toContain('Stopping')
		expect(container.textContent).not.toContain('Queue message')
		expect(container.querySelector('button')?.disabled).toBe(true)
	})
})
