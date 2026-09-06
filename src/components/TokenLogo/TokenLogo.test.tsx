// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { TokenLogo } from '.'

describe('TokenLogo', () => {
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

	test('tries each unique source once before showing a circular, fixed-size fallback', async () => {
		await act(async () =>
			root.render(
				<TokenLogo src="https://example.com/logo.png" fallbackSrc="https://example.com/fallback.png" size={32} />
			)
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
		expect(image?.classList.contains('hidden')).toBe(true)

		expect(container.innerHTML).toContain('rounded-full')
		expect(container.firstElementChild?.getAttribute('style')).toBe('height: 32px; width: 32px;')
	})

	test('resets the error state when the source props change', async () => {
		await act(async () => root.render(<TokenLogo src="https://example.com/bad.png" />))

		let image = container.querySelector('img')
		await act(async () => image?.dispatchEvent(new Event('error')))
		await act(async () => image?.dispatchEvent(new Event('error')))
		expect(image?.classList.contains('hidden')).toBe(true)

		await act(async () => root.render(<TokenLogo src="https://example.com/good.png" />))

		image = container.querySelector('img')
		expect(image?.getAttribute('src')).toBe('https://example.com/good.png')
		expect(image?.classList.contains('hidden')).toBe(false)
	})

	test('skips a fallback URL that was already attempted', async () => {
		await act(async () =>
			root.render(<TokenLogo src="https://example.com/logo.png" fallbackSrc="https://example.com/logo.png" />)
		)

		const image = container.querySelector('img')
		await act(async () => image?.dispatchEvent(new Event('error')))

		expect(image?.getAttribute('src')).toBe('/assets/placeholder.png')
	})

	test('treats an omitted or undefined title equally and renders a present title', async () => {
		await act(async () => root.render(<TokenLogo src={null} />))
		const omitted = container.innerHTML
		await act(async () => root.render(<TokenLogo src={null} title={undefined} />))
		expect(container.innerHTML).toBe(omitted)
		await act(async () => root.render(<TokenLogo src={null} title="Bitcoin" />))
		expect(container.firstElementChild?.getAttribute('title')).toBe('Bitcoin')
	})

	test('resolves exchange logos from the canonical exchange namespace', async () => {
		await act(async () => root.render(<TokenLogo name="Binance" kind="exchange" />))

		expect(container.querySelector('img')?.getAttribute('src')).toBe(
			'https://icons.llamao.fi/icons/exchanges/binance?w=48&h=48'
		)
	})
})
