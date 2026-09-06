// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { PositionControl } from '../components/PositionControl'

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
