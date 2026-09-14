// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { ProDialogFallback } from './ProDialogFallback'

let root: Root
let container: HTMLDivElement

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

function surface() {
	return document.body.querySelector<HTMLDivElement>('[data-testid="pro-dialog-fallback"]')!
}

test('the placeholder announces itself as busy and settles at the entered state', async () => {
	await act(async () => root.render(<ProDialogFallback />))
	expect(surface().getAttribute('aria-busy')).toBe('true')
	expect(surface().hasAttribute('data-enter')).toBe(true)
	expect(document.body.textContent).toContain('Loading dialog')
	expect(surface().className).toContain('animate-pro-fade-in')
	expect(container.querySelector('[data-testid="pro-dialog-fallback"]')).toBeNull()
	expect(document.body.querySelector('[aria-hidden="true"].bg-screen-dim')).not.toBeNull()
})

test('width picks the dialog it stands in for', async () => {
	await act(async () => root.render(<ProDialogFallback width="md" />))
	expect(surface().className).toContain('--dialog-width:880px')

	await act(async () => root.render(<ProDialogFallback width="lg" />))
	expect(surface().className).toContain('--dialog-width:1120px')
})

test('the sheet variant mirrors the Add card geometry instead of a centered dialog', async () => {
	await act(async () => root.render(<ProDialogFallback sheet />))
	const sheet = surface()
	expect(sheet.className).toContain('max-w-6xl')
	expect(sheet.className).toContain('border-l border-pro-cards-border')
	expect(sheet.className).not.toContain('--dialog-width')
	expect(document.body.querySelector('.bg-screen-dim')).toBeNull()
})
