// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { PoolHistoryRange } from '../types'
import { useWidestHistory } from '../useWidestHistory'

describe('useWidestHistory', () => {
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

	test('holds a wider fetch while access is pending and retries when it resolves', async () => {
		const load = vi.fn(async () => 'max-model')
		let enabled = false
		let latest: ReturnType<typeof useWidestHistory<string>>
		function Harness({ range }: { range: PoolHistoryRange }) {
			latest = useWidestHistory('30d', 'initial-model', range, load, enabled)
			return null
		}
		const render = async () => {
			await act(async () => {
				root.render(<Harness range="max" />)
				await Promise.resolve()
			})
		}

		await render()
		expect(load).not.toHaveBeenCalled()
		expect(latest!.model).toBe('initial-model')

		enabled = true
		await render()
		expect(load).toHaveBeenCalledOnce()
		expect(load).toHaveBeenCalledWith('max')
		expect(latest!.model).toBe('max-model')
	})

	test('a range that failed shows loading, not the error, when the reader comes back to it', async () => {
		const load = vi
			.fn<(range: PoolHistoryRange) => Promise<string>>()
			.mockRejectedValueOnce(new Error('offline'))
			.mockReturnValueOnce(new Promise(() => {}))
		let latest: ReturnType<typeof useWidestHistory<string>>
		function Harness({ range }: { range: PoolHistoryRange }) {
			latest = useWidestHistory('30d', 'initial-model', range, load)
			return null
		}
		const show = (range: PoolHistoryRange) =>
			act(async () => {
				root.render(<Harness range={range} />)
				await Promise.resolve()
			})

		await show('max')
		expect(latest!).toEqual({ model: 'initial-model', loading: false, error: true })

		await show('30d')
		await show('max')
		expect(load).toHaveBeenCalledTimes(2)
		expect(latest!).toEqual({ model: 'initial-model', loading: true, error: false })
	})
})
