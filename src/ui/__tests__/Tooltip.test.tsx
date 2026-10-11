// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { compile } from 'tailwindcss'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { Button } from '../Button'
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
	await waitForUi(() => expect(tooltipText()).toBe('Sum of value locked in DeFi'))
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
	await waitForUi(() => expect(tooltipText()).toBe('Pinned to the top'))
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
	await waitForUi(() => expect(tooltipText()).toBe('Open the DEX dashboard'))
})

test('reports a definition that takes focus inside another control', async () => {
	const errors: Array<string> = []
	// Replaces the test setup's console.error, which fails the test on this report.
	const spy = vi.spyOn(console, 'error').mockImplementation((message: unknown) => void errors.push(String(message)))
	await act(async () =>
		root.render(
			<button type="button">
				<Tooltip content="Total value locked" tabIndex={0}>
					TVL
				</Tooltip>
			</button>
		)
	)
	spy.mockRestore()
	expect(errors.filter((message) => message.startsWith('Nested tab stop:'))).toHaveLength(1)
})

/** Styles the rendered tree with the real Tailwind utilities its classes generate. */
async function applyTailwind() {
	const candidates = [...container.querySelectorAll('*')].flatMap((el) => [...el.classList])
	const style = document.createElement('style')
	style.textContent = (await compile('@tailwind utilities;')).build(candidates)
	container.append(style)
}

test('no anchor clips its content, so a button keeps its touch target past its edges', async () => {
	await act(async () =>
		root.render(
			<>
				<Tooltip content="Open website" render={<Button variant="ghost" size="md" square aria-label="Open website" />}>
					<svg />
				</Tooltip>
				<Tooltip content="Liquid staking">LSD</Tooltip>
			</>
		)
	)
	await applyTailwind()
	const button = container.querySelector('button[aria-label="Open website"]')!
	const textAnchor = [...container.querySelectorAll('span')].find((el) => el.textContent === 'LSD')!
	expect([getComputedStyle(button).overflow, getComputedStyle(textAnchor).overflow]).not.toContain('hidden')
})

test('a render anchor keeps its own layout, so a truncating link can shrink beside its siblings', async () => {
	await act(async () =>
		root.render(
			<Tooltip content="3 markets here: Spot, USD Perps" render={<a href="/token/USDC" className="min-w-0 truncate" />}>
				USDC
			</Tooltip>
		)
	)
	await applyTailwind()
	const link = getComputedStyle(container.querySelector('a')!)
	expect(link.display).not.toBe('flex')
	expect(link.flexShrink).not.toBe('0')
})
