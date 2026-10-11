// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { TokenLogo } from '..'

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

	test('resolves exchange logos from the canonical exchange namespace', async () => {
		await act(async () => root.render(<TokenLogo name="Binance" kind="exchange" />))

		expect(container.querySelector('img')?.getAttribute('src')).toBe(
			'https://icons.llamao.fi/icons/exchanges/binance?w=48&h=48'
		)
	})
})
