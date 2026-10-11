// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SurfaceBodyStatus } from '~/ui/Status'
import { alertTexts } from '~/utils/testing/fieldErrors'
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

	// Mirrors the chart panels: the failed read and its Try again render before loading.
	function Chart({ range, load }: { range: PoolHistoryRange; load: (range: PoolHistoryRange) => Promise<string> }) {
		const { model, loading, failedRead } = useWidestHistory('30d', 'initial-model', range, load)
		if (failedRead)
			return (
				<SurfaceBodyStatus variant="error" retry={failedRead}>
					Couldn&apos;t load {range} history.
				</SurfaceBodyStatus>
			)
		if (loading) return <p role="status">Loading</p>
		return <p>{model}</p>
	}
	const show = (range: PoolHistoryRange, load: (range: PoolHistoryRange) => Promise<string>) =>
		act(async () => {
			root.render(<Chart range={range} load={load} />)
			await Promise.resolve()
		})
	const tryAgain = () => container.querySelector('button')!
	const clickTryAgain = () =>
		act(async () => {
			tryAgain().click()
			await Promise.resolve()
		})

	test('a range that failed shows loading, not the error, when the reader comes back to it', async () => {
		const load = vi
			.fn<(range: PoolHistoryRange) => Promise<string>>()
			.mockRejectedValueOnce(new Error('offline'))
			.mockReturnValueOnce(new Promise(() => {}))

		await show('max', load)
		expect(alertTexts(container)).toHaveLength(1)

		await show('30d', load)
		await show('max', load)
		expect(load).toHaveBeenCalledTimes(2)
		expect(alertTexts(container)).toEqual([])
		expect(container.querySelector('[role=status]')).not.toBeNull()
	})

	test('Try again reruns the failed range and keeps the error up while it runs', async () => {
		let resolve!: (model: string) => void
		const load = vi
			.fn<(range: PoolHistoryRange) => Promise<string>>()
			.mockRejectedValueOnce(new Error('offline'))
			.mockReturnValueOnce(new Promise((r) => (resolve = r)))

		await show('max', load)
		expect(tryAgain().getAttribute('aria-busy')).toBeNull()

		await clickTryAgain()
		expect(load).toHaveBeenLastCalledWith('max')
		expect(alertTexts(container)).toHaveLength(1)
		expect(tryAgain().getAttribute('aria-busy')).toBe('true')

		await act(async () => resolve('max-model'))
		expect(alertTexts(container)).toEqual([])
		expect(container.textContent).toBe('max-model')
	})

	test('a Try again that fails again keeps the error and frees its button', async () => {
		const load = vi.fn<(range: PoolHistoryRange) => Promise<string>>().mockRejectedValue(new Error('offline'))

		await show('max', load)
		await clickTryAgain()
		await act(async () => Promise.resolve())

		expect(load).toHaveBeenCalledTimes(2)
		expect(alertTexts(container)).toHaveLength(1)
		expect(tryAgain().getAttribute('aria-busy')).toBeNull()
	})
})
