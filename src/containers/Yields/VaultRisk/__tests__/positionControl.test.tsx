// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHydrated } from '~/utils/testing/hydration'
import { waitForUi } from '~/utils/testing/waitForUi'
import { PositionControl, PositionProvider, usePositionUsd } from '../components/PositionControl'

describe('PositionControl deposit input', () => {
	let container: HTMLDivElement
	let root: Root

	function render(position: number | null, onChange = vi.fn()) {
		return act(async () => root.render(<PositionControl position={position} onChange={onChange} />))
	}

	function input() {
		return container.querySelector<HTMLInputElement>('#risk-position')!
	}

	function type(value: string) {
		const el = input()
		const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
		return act(async () => {
			setValue.call(el, value)
			el.dispatchEvent(new Event('input', { bubbles: true }))
		})
	}

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

	test('shows an existing deposit on mount, so committing it keeps the value', async () => {
		const onChange = vi.fn()
		await render(10_000, onChange)
		expect(input().value).toBe('10,000')

		// React's onBlur is delivered by the native focusout event, not blur.
		await act(async () => input().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
		expect(onChange).toHaveBeenCalledWith(10_000)
	})

	test('starts empty when there is no deposit', async () => {
		await render(null)
		expect(input().value).toBe('')
	})

	test('restarts from a deposit committed elsewhere', async () => {
		await render(null)
		await type('250')
		await render(10_000)
		expect(input().value).toBe('10,000')
	})
})

describe('the deposit amount shared by the risk section', () => {
	const STORAGE_KEY = 'llama-risk-position-usd'

	function Control() {
		const [position, setPosition] = usePositionUsd()
		return <PositionControl position={position} onChange={setPosition} />
	}
	function Readout() {
		const [position] = usePositionUsd()
		return <output>{position ?? 'pool'}</output>
	}
	const section = (
		<PositionProvider>
			<Control />
			<Readout />
		</PositionProvider>
	)
	const readout = (container: HTMLElement) => container.querySelector('output')!.textContent

	afterEach(() => {
		localStorage.clear()
		vi.restoreAllMocks()
	})

	test('hydrates in pool mode, then shows the stored amount', async () => {
		localStorage.setItem(STORAGE_KEY, '25000')
		const page = await renderHydrated(section, { pageClockSec: 1_790_000_000 })
		expect(page.serverHtml).toContain('<output>pool</output>')
		expect(page.errors).toEqual([])
		expect(readout(page.container)).toBe('25000')
		await page.unmount()
	})

	test('follows an amount saved in another tab', async () => {
		const page = await renderHydrated(section, { pageClockSec: 1_790_000_000 })
		expect(readout(page.container)).toBe('pool')
		localStorage.setItem(STORAGE_KEY, '5000')
		await act(async () =>
			window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, storageArea: localStorage }))
		)
		await waitForUi(() => expect(readout(page.container)).toBe('5000'))
		await page.unmount()
	})

	test('keeps a chosen amount for the visit when storage refuses to save it', async () => {
		vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
			throw new DOMException('Blocked', 'SecurityError')
		})
		const page = await renderHydrated(section, { pageClockSec: 1_790_000_000 })
		const preset = [...page.container.querySelectorAll('button')].find((button) => button.textContent === '$10k')!
		await act(async () => preset.click())
		expect(readout(page.container)).toBe('10000')
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
		await page.unmount()
	})
})
