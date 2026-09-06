// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DateRangePicker } from '../DateRangePicker'
import { RowLimitPicker } from '../RowLimitPicker'
import type { DateRangeConfig } from '../savedDownloads'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
function button(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => el.textContent?.trim() === name || el.getAttribute('aria-label') === name
	)!
}
async function click(el: HTMLElement) {
	await act(async () => {
		el.focus()
		el.click()
	})
}
async function input(el: HTMLInputElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value)
		el.dispatchEvent(new Event('input', { bubbles: true }))
	})
}
async function escape(el: HTMLElement) {
	await act(async () =>
		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
	)
}
test('unapplied dates keep All selected; Apply and Clear change the active range', async () => {
	const changed = vi.fn()
	function Harness() {
		const [value, setValue] = useState<DateRangeConfig | null>(null)
		return (
			<DateRangePicker
				value={value}
				onChange={(next) => {
					changed(next)
					setValue(next)
				}}
			/>
		)
	}
	await act(async () => root.render(<Harness />))
	expect(changed).not.toHaveBeenCalled()
	const trigger = button('Date range')
	await click(trigger)
	const dates = [...document.querySelectorAll<HTMLInputElement>('input[type="date"]')]
	await input(dates[0], '2026-01-01')
	expect(button('All').getAttribute('aria-pressed')).toBe('true')
	expect(changed).not.toHaveBeenCalled()
	await escape(dates[0])
	await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
	await click(trigger)
	const reopened = [...document.querySelectorAll<HTMLInputElement>('input[type="date"]')]
	expect(reopened[0].value).toBe('2026-01-01')
	await input(reopened[1], '2026-01-02')
	await click(button('Apply'))
	expect(changed).toHaveBeenLastCalledWith({ kind: 'custom', from: '2026-01-01', to: '2026-01-02' })
	await click(trigger)
	expect(button('All').getAttribute('aria-pressed')).toBe('false')
	await click(button('Clear'))
	expect(changed).toHaveBeenLastCalledWith(null)
	await click(trigger)
	expect(button('All').getAttribute('aria-pressed')).toBe('true')
	expect(document.querySelector<HTMLInputElement>('input[type="date"]')!.value).toBe('')
	await input(document.querySelector<HTMLInputElement>('input[type="date"]')!, '2026-03-01')
	await click(button('Clear'))
	await click(trigger)
	expect(document.querySelector<HTMLInputElement>('input[type="date"]')!.value).toBe('')
})
test('row limit errors identify the input; correcting and clearing restore unrestricted rows', async () => {
	const changed = vi.fn()
	function Harness() {
		const [value, setValue] = useState<number | null>(null)
		return (
			<Ariakit.DialogProvider defaultOpen>
				<Ariakit.Dialog aria-label="Dataset preview">
					<RowLimitPicker
						value={value}
						totalRows={500}
						onChange={(next) => {
							changed(next)
							setValue(next)
						}}
					/>
				</Ariakit.Dialog>
			</Ariakit.DialogProvider>
		)
	}
	await act(async () => root.render(<Harness />))
	const trigger = button('Row limit')
	await click(trigger)
	const field = document.querySelector<HTMLInputElement>('[aria-label="Custom row limit"]')!
	await input(field, '-1')
	// Submit directly to exercise the custom error path as well as native validation.
	await act(async () => field.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
	expect(changed).not.toHaveBeenCalled()
	expect(field.getAttribute('aria-invalid')).toBe('true')
	expect(document.getElementById(field.getAttribute('aria-describedby')!)?.textContent).toBe('Enter a positive number')
	await input(field, '250')
	expect(field.getAttribute('aria-invalid')).toBe('false')
	await click(button('Apply'))
	expect(changed).toHaveBeenCalledExactlyOnceWith(250)
	await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
	await click(button('Clear row limit'))
	expect(document.activeElement).toBe(trigger)
	expect(changed).toHaveBeenLastCalledWith(null)
	await click(trigger)
	expect(button('All').getAttribute('aria-pressed')).toBe('true')
})
