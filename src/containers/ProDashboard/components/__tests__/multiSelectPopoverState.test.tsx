// @vitest-environment happy-dom

import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { AriakitVirtualizedMultiSelect } from '../AriakitVirtualizedMultiSelect'

const options = [
	{ value: 'aave', label: 'Aave' },
	{ value: 'compound', label: 'Compound' },
	{ value: 'uniswap', label: 'Uniswap' }
]

describe('the virtualized multi-select popover keeps no state while closed', () => {
	let container: HTMLDivElement
	let root: Root

	function render(element: ReactElement) {
		return act(async () => {
			root.render(element)
		})
	}

	const disclosure = () => document.querySelector('button') as HTMLButtonElement
	const searchInput = () => document.querySelector('input[placeholder="Search..."]') as HTMLInputElement | null

	function click(el: HTMLElement) {
		return act(async () => {
			el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		})
	}

	function type(el: HTMLInputElement, value: string) {
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

	test('a closed popover renders no search box', async () => {
		await render(
			<AriakitVirtualizedMultiSelect label="Protocols" options={options} selectedValues={[]} onChange={vi.fn()} />
		)
		expect(searchInput()).toBeNull()
	})

	test('reopening starts from an empty search', async () => {
		await render(
			<AriakitVirtualizedMultiSelect label="Protocols" options={options} selectedValues={[]} onChange={vi.fn()} />
		)

		await click(disclosure())
		const input = searchInput()!
		await type(input, 'uni')
		expect(searchInput()!.value).toBe('uni')

		await click(disclosure())
		expect(searchInput()).toBeNull()

		await click(disclosure())
		expect(searchInput()!.value).toBe('')
	})
})
