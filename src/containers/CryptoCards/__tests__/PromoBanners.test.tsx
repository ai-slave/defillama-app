// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { PromoBanners } from '../PromoBanners'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('the Ethena Pay banner reveals an invite code to copy and the app to use it in', async () => {
	await act(async () => root.render(<PromoBanners />))
	expect(document.body.textContent).not.toContain('TDQTXQ')

	await act(async () =>
		document.querySelector<HTMLButtonElement>('[aria-label="Show Ethena Pay invite code"]')!.click()
	)
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())

	const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
	expect(dialog.querySelector('output')?.textContent).toBe('TDQTXQ')
	expect(dialog.querySelector<HTMLAnchorElement>('a')?.href).toBe('https://pay.ethena.fi/download')

	await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="Copy Ethena Pay invite code"]')!.click())
	expect(await navigator.clipboard.readText()).toBe('TDQTXQ')
})
