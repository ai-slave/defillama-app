// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useIdleChartComputation } from '../useIdleChartComputation'

describe('useIdleChartComputation', () => {
	let container: HTMLDivElement
	let root: Root
	let callbacks: Array<IdleRequestCallback | null>

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		callbacks = []
		window.requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
			callbacks.push(callback)
			return callbacks.length
		})
		window.cancelIdleCallback = vi.fn((id: number) => {
			callbacks[id - 1] = null
		})
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('defers construction and discards a stale scheduled signature', async () => {
		const computeFirst = vi.fn(() => 'first')
		const computeSecond = vi.fn(() => 'second')
		const rendered: Array<{ value: string; isComputing: boolean }> = []

		function Harness({ signature, compute }: { signature: string; compute: () => string }) {
			const result = useIdleChartComputation({ enabled: true, signature, input: null, compute, emptyValue: 'empty' })
			rendered.push(result)
			return null
		}

		await act(async () => root.render(<Harness signature="first" compute={computeFirst} />))
		expect(computeFirst).not.toHaveBeenCalled()
		expect(rendered.at(-1)).toEqual({ value: 'empty', isComputing: true })

		await act(async () => root.render(<Harness signature="second" compute={computeSecond} />))
		expect(callbacks[0]).toBeNull()
		expect(computeFirst).not.toHaveBeenCalled()

		await act(async () => callbacks[1]?.({ didTimeout: false, timeRemaining: () => 10 }))
		expect(computeSecond).toHaveBeenCalledOnce()
		expect(rendered.at(-1)).toEqual({ value: 'second', isComputing: false })
	})

	test('computes from the input current when the idle callback runs, without rescheduling on input alone', async () => {
		const compute = vi.fn((input: { rows: number }) => `rows:${input.rows}`)
		const rendered: Array<{ value: string; isComputing: boolean }> = []

		function Harness({ rows }: { rows: number }) {
			const result = useIdleChartComputation({
				enabled: true,
				signature: 'same',
				input: { rows },
				compute,
				emptyValue: 'empty'
			})
			rendered.push(result)
			return null
		}

		await act(async () => root.render(<Harness rows={1} />))
		// A refetch delivered new inputs under the same signature: no new idle callback is scheduled.
		await act(async () => root.render(<Harness rows={2} />))
		expect(callbacks).toHaveLength(1)

		await act(async () => callbacks[0]?.({ didTimeout: false, timeRemaining: () => 10 }))
		expect(compute).toHaveBeenCalledExactlyOnceWith({ rows: 2 })
		expect(rendered.at(-1)).toEqual({ value: 'rows:2', isComputing: false })
	})
})
