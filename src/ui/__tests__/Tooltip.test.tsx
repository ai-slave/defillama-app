// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { compile } from 'tailwindcss'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { tabTo } from '~/utils/testing/keyboard'
import { waitForUi } from '~/utils/testing/waitForUi'
import { Button } from '../Button'
import { Definition, Tooltip } from '../Tooltip'

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
	await tabTo(link)
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

let screenX = 0
/** The pointer enters the element and moves over it: Ariakit opens a tooltip only on a move after an enter. */
async function hover(element: Element) {
	screenX += 10
	await act(async () => {
		element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }))
		element.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, screenX, screenY: 10 }))
	})
}

test('an instant tooltip opens on the first hover move, where a plain one waits', async () => {
	await act(async () =>
		root.render(
			<>
				<Tooltip content="Waits for the pointer to settle">Plain</Tooltip>
				<Tooltip instant content="$1.2m weighted">
					12%
				</Tooltip>
			</>
		)
	)
	const [plain, instant] = [...container.querySelectorAll('span')]
	await hover(plain)
	await act(async () => new Promise((resolve) => setTimeout(resolve, 50)))
	expect(tooltipText()).toBeUndefined()
	await act(async () =>
		plain.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
	)
	await hover(instant)
	expect(tooltipText()).toBe('$1.2m weighted')
})

const clippedCells = () => (
	<>
		{['ETH', 'Superstate Short Duration US Government Securities Fund'].map((text) => (
			<Tooltip key={text} content={text} onlyWhenClipped render={<span className="block max-w-full truncate" />}>
				{text}
			</Tooltip>
		))}
	</>
)

/** happy-dom has no layout, so give each cell the widths a browser would measure. */
function measureCells() {
	const [fits, clipped] = [...container.querySelectorAll('span')]
	Object.defineProperties(fits, { scrollWidth: { value: 30 }, clientWidth: { value: 110 } })
	Object.defineProperties(clipped, { scrollWidth: { value: 380 }, clientWidth: { value: 190 } })
	return { fits, clipped }
}

test('a tap shows the full value of clipped text and nothing for text that fits', async () => {
	await act(async () => root.render(clippedCells()))
	const { fits, clipped } = measureCells()
	await act(async () => fits.dispatchEvent(new Event('touchstart', { bubbles: true })))
	await act(async () => new Promise((resolve) => setTimeout(resolve, 50)))
	expect(tooltipText()).toBeUndefined()
	await act(async () => clipped.dispatchEvent(new Event('touchstart', { bubbles: true })))
	await waitForUi(() => expect(tooltipText()).toBe('Superstate Short Duration US Government Securities Fund'))
})

test('a hover shows the full value of clipped text and nothing for text that fits', async () => {
	await act(async () => root.render(clippedCells()))
	const { fits, clipped } = measureCells()
	await hover(fits)
	await act(async () => new Promise((resolve) => setTimeout(resolve, 600)))
	expect(tooltipText()).toBeUndefined()
	await hover(clipped)
	await waitForUi(() => expect(tooltipText()).toBe('Superstate Short Duration US Government Securities Fund'))
})

test('a definition is a tab stop that opens on focus, and text without one is not', async () => {
	await act(async () =>
		root.render(
			<>
				<Definition as="h2" content="Sum of value locked in DeFi">
					Total Value Locked
				</Definition>
				<Definition content={null}>Fees</Definition>
			</>
		)
	)
	const heading = container.querySelector('h2')!
	const fees = [...container.querySelectorAll('span')].find((el) => el.textContent === 'Fees')!
	expect([heading.tabIndex, fees.tabIndex]).toEqual([0, -1])
	await tabTo(heading)
	await waitForUi(() => expect(tooltipText()).toBe('Sum of value locked in DeFi'))
})
