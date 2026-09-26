// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Tooltip } from '../Tooltip'

let container: HTMLDivElement
let root: Root
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const tooltipText = () => document.querySelector('[role="tooltip"]')?.textContent

test('opens on tap when the anchor renders as a heading', async () => {
	await act(async () =>
		root.render(
			<Tooltip content="Sum of value locked in DeFi" render={<h2 />}>
				Total Value Locked
			</Tooltip>
		)
	)
	await act(async () => container.querySelector('h2')!.dispatchEvent(new Event('touchstart', { bubbles: true })))
	await vi.waitFor(() => expect(tooltipText()).toBe('Sum of value locked in DeFi'))
})

test('inside a row button, a tap opens only plain anchors and leaves rendered ones to the row', async () => {
	await act(async () =>
		root.render(
			<button type="button">
				<Tooltip content="New response ready" render={<span aria-label="Unseen completion" />}>
					{null}
				</Tooltip>
				<Tooltip content="Pinned to the top">Pinned</Tooltip>
			</button>
		)
	)
	await act(async () =>
		container
			.querySelector('[aria-label="Unseen completion"]')!
			.dispatchEvent(new Event('touchstart', { bubbles: true }))
	)
	await act(async () => new Promise((resolve) => setTimeout(resolve, 50)))
	expect(tooltipText()).toBeUndefined()
	const pinned = [...container.querySelectorAll('span')].find((el) => el.textContent === 'Pinned')!
	await act(async () => pinned.dispatchEvent(new Event('touchstart', { bubbles: true })))
	await vi.waitFor(() => expect(tooltipText()).toBe('Pinned to the top'))
})

test('leaves a tap on a link anchor to the link and still opens on focus', async () => {
	await act(async () =>
		root.render(
			<Tooltip content="Open the DEX dashboard" render={<a href="/dexs" />}>
				DEXs Volume
			</Tooltip>
		)
	)
	const link = container.querySelector('a')!
	await act(async () => link.dispatchEvent(new Event('touchstart', { bubbles: true })))
	await act(async () => new Promise((resolve) => setTimeout(resolve, 50)))
	expect(tooltipText()).toBeUndefined()
	await act(async () => link.focus())
	await vi.waitFor(() => expect(tooltipText()).toBe('Open the DEX dashboard'))
})
