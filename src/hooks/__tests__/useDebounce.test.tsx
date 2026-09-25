// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useDebouncedCallback } from '../useDebounce'

describe('useDebouncedCallback', () => {
	let container: HTMLDivElement
	let root: Root
	let debounced: ReturnType<typeof useDebouncedCallback<(value: string) => void>>
	const onCall = vi.fn()

	function Harness({ delay = 100, prefix = '' }: { delay?: number; prefix?: string }) {
		debounced = useDebouncedCallback((value: string) => onCall(prefix + value), delay)
		return null
	}

	async function render(props: { delay?: number; prefix?: string } = {}) {
		await act(async () => root.render(<Harness {...props} />))
	}

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.useFakeTimers()
		onCall.mockClear()
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		await render()
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.useRealTimers()
	})

	test('restarts the delay on each call and invokes once with the latest arguments', async () => {
		act(() => debounced('a'))
		await act(async () => vi.advanceTimersByTimeAsync(60))
		act(() => debounced('b'))
		await act(async () => vi.advanceTimersByTimeAsync(60))
		expect(onCall).not.toHaveBeenCalled()

		await act(async () => vi.advanceTimersByTimeAsync(40))
		expect(onCall).toHaveBeenCalledExactlyOnceWith('b')
	})

	test('cancel drops the pending call', async () => {
		act(() => {
			debounced('a')
			debounced.cancel()
		})
		expect(vi.getTimerCount()).toBe(0)
		await act(async () => vi.advanceTimersByTimeAsync(100))
		expect(onCall).not.toHaveBeenCalled()
	})

	test('flush invokes the pending call immediately and clears the timer', async () => {
		act(() => {
			debounced('a')
			debounced.flush()
		})
		expect(onCall).toHaveBeenCalledExactlyOnceWith('a')
		expect(vi.getTimerCount()).toBe(0)

		await act(async () => vi.advanceTimersByTimeAsync(100))
		expect(onCall).toHaveBeenCalledOnce()
	})

	test('flush with nothing pending does not invoke', async () => {
		act(() => debounced.flush())
		expect(onCall).not.toHaveBeenCalled()
	})

	test('unmount cancels the pending call', async () => {
		act(() => debounced('a'))
		await act(async () => root.unmount())
		await act(async () => vi.advanceTimersByTimeAsync(100))
		expect(onCall).not.toHaveBeenCalled()
	})

	// The handles keep a stable identity across renders, so they must not close over a stale callback.
	test('invokes the callback from the latest render', async () => {
		act(() => debounced('a'))
		await render({ prefix: 'new-' })
		await act(async () => vi.advanceTimersByTimeAsync(100))
		expect(onCall).toHaveBeenCalledExactlyOnceWith('new-a')
	})

	test('a zero or negative delay still defers past the current task', async () => {
		await render({ delay: -5 })
		act(() => debounced('a'))
		expect(onCall).not.toHaveBeenCalled()

		await act(async () => vi.advanceTimersByTimeAsync(0))
		expect(onCall).toHaveBeenCalledExactlyOnceWith('a')
	})
})
