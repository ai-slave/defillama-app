// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { TruncatedText } from '../TruncatedText'

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

test('a tap shows the full value of clipped text and nothing for text that fits', async () => {
	await act(async () =>
		root.render(
			<>
				<TruncatedText text="ETH" />
				<TruncatedText text="Superstate Short Duration US Government Securities Fund" />
			</>
		)
	)
	const [fits, clipped] = [...container.querySelectorAll('span')]
	// happy-dom has no layout, so give each cell the widths a browser would measure.
	Object.defineProperties(fits, { scrollWidth: { value: 30 }, clientWidth: { value: 110 } })
	Object.defineProperties(clipped, { scrollWidth: { value: 380 }, clientWidth: { value: 190 } })

	await act(async () => fits.dispatchEvent(new Event('touchstart', { bubbles: true })))
	await act(async () => new Promise((resolve) => setTimeout(resolve, 50)))
	expect(tooltipText()).toBeUndefined()
	await act(async () => clipped.dispatchEvent(new Event('touchstart', { bubbles: true })))
	await waitForUi(() => expect(tooltipText()).toBe('Superstate Short Duration US Government Securities Fund'))
})
