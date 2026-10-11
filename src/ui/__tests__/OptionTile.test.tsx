// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, onTestFinished, test } from 'vitest'
import { OptionTile } from '../OptionTile'

async function render(node: React.ReactNode) {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	onTestFinished(async () => {
		await act(async () => root.unmount())
		container.remove()
	})
	await act(async () => root.render(node))
	return container
}

test('a tile with a box checks it from `selected`', async () => {
	const container = await render(
		<OptionTile layout="row" selected check="box">
			<span>TVL</span>
		</OptionTile>
	)
	expect(container.querySelector('button')!.lastElementChild?.getAttribute('data-checked')).toBe('true')
})

function RadioTiles() {
	const [value, setValue] = useState('chain')
	return (
		<Ariakit.RadioProvider value={value} setValue={(next) => setValue(next as string)}>
			<Ariakit.RadioGroup aria-label="Grouping">
				<OptionTile layout="stack" radio="chain">
					<span>By chain</span>
				</OptionTile>
				<OptionTile layout="stack" radio="protocol">
					<span>By protocol</span>
				</OptionTile>
			</Ariakit.RadioGroup>
		</Ariakit.RadioProvider>
	)
}

test('radio tiles pick on arrow keys and on a press, and their text names each radio', async () => {
	const container = await render(<RadioTiles />)
	const [chain, protocol] = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
	expect(chain.closest('label')!.textContent).toBe('By chain')
	expect(chain.checked).toBe(true)
	// A button with role="radio" would only move focus here; the tile's native radio also picks.
	await act(async () => {
		chain.focus()
		chain.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
	expect(document.activeElement).toBe(protocol)
	expect(protocol.checked).toBe(true)
	expect(chain.checked).toBe(false)
	await act(async () => chain.click())
	expect(chain.checked).toBe(true)
	expect(protocol.checked).toBe(false)
})
