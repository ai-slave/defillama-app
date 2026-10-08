// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { EntityPickerList } from '../EntityPickerList'

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

function Picker() {
	const [selected, setSelected] = useState(['ethereum', 'arbitrum'])
	return (
		<EntityPickerList
			error={null}
			mode="chain"
			entities={[
				{ value: 'ethereum', label: 'Ethereum' },
				{ value: 'arbitrum', label: 'Arbitrum' }
			]}
			selectedEntities={selected}
			onToggle={() => {}}
			onClear={() => setSelected([])}
		/>
	)
}

test('clearing the selection moves focus to the search instead of dropping it', async () => {
	await act(async () => root.render(<Picker />))
	const clear = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Clear')!
	await act(async () => {
		clear.focus()
		clear.click()
	})
	expect(container.textContent).not.toContain('2 selected')
	const searchLabel = [...container.querySelectorAll('label')].find((label) => label.textContent === 'Search chains')!
	expect(document.activeElement).toBe(document.getElementById(searchLabel.htmlFor))
})
