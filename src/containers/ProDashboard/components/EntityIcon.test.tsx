// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { EntityIcon } from './EntityIcon'

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

test('a source renders a lazy image the title already names', async () => {
	await act(async () => root.render(<EntityIcon src="https://icons.llama.fi/aave.png" name="Aave" />))
	const image = container.querySelector('img')
	expect(image?.getAttribute('src')).toBe('https://icons.llama.fi/aave.png')
	expect(image?.getAttribute('loading')).toBe('lazy')
	expect(image?.getAttribute('alt')).toBe('')
})

test('a failing image falls back to the entity initial', async () => {
	await act(async () => root.render(<EntityIcon src="https://icons.llama.fi/missing.png" name="Aave" />))
	const image = container.querySelector('img')!
	await act(async () => image.dispatchEvent(new Event('error')))
	expect(container.querySelector('img')).toBeNull()
	expect(container.textContent).toBe('A')
})

test('a missing source renders the initial straight away', async () => {
	await act(async () => root.render(<EntityIcon src={null} name="uniswap" />))
	expect(container.querySelector('img')).toBeNull()
	expect(container.textContent).toBe('U')
	expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
})

test('a new source is tried again after an earlier one failed', async () => {
	await act(async () => root.render(<EntityIcon src="https://icons.llama.fi/missing.png" name="Aave" />))
	await act(async () => container.querySelector('img')!.dispatchEvent(new Event('error')))
	expect(container.querySelector('img')).toBeNull()

	await act(async () => root.render(<EntityIcon src="https://icons.llama.fi/uniswap.png" name="Uniswap" />))
	expect(container.querySelector('img')?.getAttribute('src')).toBe('https://icons.llama.fi/uniswap.png')
})
