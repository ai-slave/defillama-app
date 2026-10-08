// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { DateInput } from '../DateInput'

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

/** An end date field whose page accepts only dates on or after the start, as Token PnL does. */
function EndDate({ start }: { start: string }) {
	const [end, setEnd] = useState('2026-09-20')
	return (
		<DateInput
			label="End Date"
			value={end}
			errorFor={(date) => (date < start ? 'Choose an end date on or after the start date.' : null)}
			onChange={setEnd}
		/>
	)
}

const field = () => container.querySelector('input')!

async function pick(value: string) {
	await act(async () => {
		field().focus()
		const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
		setValue.call(field(), value)
		field().dispatchEvent(new Event('input', { bubbles: true }))
	})
}

const blur = () => act(async () => field().blur())
const error = () => document.getElementById(field().getAttribute('aria-describedby') ?? '')?.textContent ?? null

test('a date the page rejects says why under the field, then gives way to the committed date on blur', async () => {
	await act(async () => root.render(<EndDate start="2026-09-10" />))

	await pick('2026-09-01')
	expect(field().value).toBe('2026-09-01')
	expect(field().getAttribute('aria-invalid')).toBe('true')
	expect(error()).toBe('Choose an end date on or after the start date.')

	await blur()
	expect(field().value).toBe('2026-09-20')
	expect(field().getAttribute('aria-invalid')).toBe(null)
	expect(error()).toBe(null)
})

test('a date the page accepts stays in the field after it loses focus', async () => {
	await act(async () => root.render(<EndDate start="2026-09-10" />))

	await pick('2026-09-15')
	await blur()
	expect(field().value).toBe('2026-09-15')
})
