// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { MultiSelectCombobox } from '../MultiSelectCombobox'

let root: Root
let host: HTMLDivElement
const data = [
	{ value: 'aave', label: 'Aave' },
	{ value: 'curve', label: 'Curve' }
]

function Picker() {
	const [selected, setSelected] = useState(['curve'])
	return (
		<MultiSelectCombobox
			heading="Protocols"
			placeholder="Select protocols…"
			data={data}
			selectedValues={selected}
			setSelectedValues={setSelected}
		/>
	)
}

beforeEach(async () => {
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
	await act(async () => root.render(<Picker />))
})

afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
})

const input = () => host.querySelector<HTMLInputElement>('input')!
const options = () => [...document.querySelectorAll('[role="option"]')].map((el) => el.textContent?.trim())

async function search(value: string) {
	await act(async () => {
		input().focus()
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value)
		input().dispatchEvent(new Event('input', { bubbles: true }))
	})
	await waitForUi(() => expect(options()).toEqual(['Aave']))
}

async function pressKey(key: string) {
	await act(async () => input().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })))
}

test('typing filters options with one visible search field containing the query', async () => {
	await search('aave')
	expect([...document.querySelectorAll<HTMLInputElement>('input')].map((el) => el.value)).toEqual(['aave'])
	expect(document.activeElement).toBe(input())
})

test('Escape clears the query on reopen without removing selected protocols', async () => {
	await search('aave')
	await pressKey('Escape')
	await waitForUi(() => expect(input().getAttribute('aria-expanded')).toBe('false'))
	expect(input().value).toBe('')
	expect(host.querySelector('button')?.textContent).toBe('Curve')
	await pressKey('ArrowDown')
	await waitForUi(() => expect(options()).toEqual(['Aave', 'Curve']))
})

test('keyboard selection adds a protocol and preserves the previous chip', async () => {
	await search('aave')
	await pressKey('ArrowDown')
	await pressKey('Enter')
	await waitForUi(() =>
		expect([...host.querySelectorAll('button')].map((el) => el.textContent)).toEqual(['Curve', 'Aave'])
	)
	expect(input().value).toBe('')
})

test('removing a chip hands focus to the next chip, and the last chip to the search field', async () => {
	await search('aave')
	await pressKey('ArrowDown')
	await pressKey('Enter')
	await waitForUi(() => expect(host.querySelectorAll('button')).toHaveLength(2))
	const curve = host.querySelector<HTMLButtonElement>('button[aria-label="Remove Curve"]')!
	await act(async () => {
		curve.focus()
		curve.click()
	})
	expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove Aave')
	await act(async () => (document.activeElement as HTMLButtonElement).click())
	expect(host.querySelectorAll('button')).toHaveLength(0)
	expect(document.activeElement).toBe(input())
})
