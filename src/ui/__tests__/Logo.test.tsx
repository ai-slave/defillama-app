// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { Logo } from '../Logo'

describe('Logo', () => {
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

	test('stops requesting images after each unique source fails', async () => {
		await act(async () =>
			root.render(<Logo src="https://example.com/logo.png" fallbackSrc="https://example.com/fallback.png" size={32} />)
		)

		const image = container.querySelector('img')
		expect(image).not.toBeNull()
		expect(image?.getAttribute('src')).toBe('https://example.com/logo.png')

		await act(async () => image?.dispatchEvent(new Event('error')))
		expect(image?.getAttribute('src')).toBe('https://example.com/fallback.png')

		await act(async () => image?.dispatchEvent(new Event('error')))
		expect(image?.getAttribute('src')).toBe('/assets/placeholder.png')

		await act(async () => image?.dispatchEvent(new Event('error')))
		expect(image?.hasAttribute('src')).toBe(false)

		await act(async () => image?.dispatchEvent(new Event('error')))
		expect(image?.hasAttribute('src')).toBe(false)
	})

	test('resets the error state when the source props change', async () => {
		await act(async () => root.render(<Logo src="https://example.com/bad.png" size={24} />))

		let image = container.querySelector('img')
		await act(async () => image?.dispatchEvent(new Event('error')))
		await act(async () => image?.dispatchEvent(new Event('error')))

		await act(async () => root.render(<Logo src="https://example.com/good.png" size={24} />))

		image = container.querySelector('img')
		expect(image?.getAttribute('src')).toBe('https://example.com/good.png')
		expect(image?.classList.contains('hidden')).toBe(false)
	})

	test('skips a fallback URL that was already attempted', async () => {
		await act(async () =>
			root.render(<Logo src="https://example.com/logo.png" fallbackSrc="https://example.com/logo.png" size={24} />)
		)

		const image = container.querySelector('img')
		await act(async () => image?.dispatchEvent(new Event('error')))

		expect(image?.getAttribute('src')).toBe('/assets/placeholder.png')
	})

	test('a missing source starts at the placeholder', async () => {
		await act(async () => root.render(<Logo src={null} size={24} />))

		expect(container.querySelector('img')?.getAttribute('src')).toBe('/assets/placeholder.png')
	})
})
