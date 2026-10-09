// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { fieldErrorTexts } from '~/utils/testing/fieldErrors'
import { waitForUi } from '~/utils/testing/waitForUi'
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
test('unapplied dates keep All selected; Apply checks the range, and Apply and Clear change the active range', async () => {
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
	const trigger = button('Date range: All')
	await click(trigger)
	const dates = [...document.querySelectorAll<HTMLInputElement>('input[type="date"]')]
	await input(dates[0], '2026-01-01')
	expect(button('All').getAttribute('aria-pressed')).toBe('true')
	expect(changed).not.toHaveBeenCalled()
	await escape(dates[0])
	await waitForUi(() => expect(document.activeElement).toBe(trigger))
	await click(trigger)
	const reopened = [...document.querySelectorAll<HTMLInputElement>('input[type="date"]')]
	expect(reopened[0].value).toBe('2026-01-01')
	const errorOf = (el: HTMLInputElement) =>
		document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent
	await click(button('Apply'))
	expect(changed).not.toHaveBeenCalled()
	expect(errorOf(reopened[1])).toBe('Choose a To date.')
	expect(document.activeElement).toBe(reopened[1])
	await input(reopened[1], '2025-12-31')
	expect(errorOf(reopened[1])).toBe('Choose a date on or after the From date.')
	await click(button('Apply'))
	expect(changed).not.toHaveBeenCalled()
	await input(reopened[1], '2026-01-02')
	expect(reopened[1].getAttribute('aria-invalid')).toBeNull()
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
test('Apply refuses typed days outside the dataset and takes its first and last day', async () => {
	const changed = vi.fn()
	await act(async () =>
		root.render(<DateRangePicker value={null} onChange={changed} minDate="2026-01-01" maxDate="2026-01-31" />)
	)
	await click(button('Date range: All'))
	const [from, to] = [...document.querySelectorAll<HTMLInputElement>('input[type="date"]')]
	const errorOf = (el: HTMLInputElement) =>
		document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent
	await input(from, '2026-02-01')
	await input(to, '2026-02-02')
	await click(button('Apply'))
	expect(changed).not.toHaveBeenCalled()
	expect(errorOf(from)).toBe('Choose a date on or before Jan 31, 2026.')
	expect(errorOf(to)).toBe('Choose a date on or before Jan 31, 2026.')
	expect(document.activeElement).toBe(from)
	await input(from, '2025-12-31')
	await input(to, '2026-01-31')
	expect(errorOf(from)).toBe('Choose a date on or after Jan 1, 2026.')
	expect(to.getAttribute('aria-invalid')).toBeNull()
	await click(button('Apply'))
	expect(changed).not.toHaveBeenCalled()
	await input(from, '2026-01-01')
	await click(button('Apply'))
	expect(changed).toHaveBeenLastCalledWith({ kind: 'custom', from: '2026-01-01', to: '2026-01-31' })
})

test('Apply says what is wrong with the row limit under it; correcting applies it, and All restores unrestricted rows', async () => {
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
	const trigger = button('Row limit: All')
	await click(trigger)
	const field = document.querySelector<HTMLInputElement>('[aria-label="Custom row limit"]')!
	const error = () => document.getElementById(field.getAttribute('aria-describedby') ?? '')?.textContent
	await click(button('Apply'))
	expect(changed).not.toHaveBeenCalled()
	expect(error()).toBe('Enter a row limit.')
	expect(document.activeElement).toBe(field)
	await input(field, '0')
	expect(error()).toBe('Enter a row limit of 1 or more.')
	expect(field.getAttribute('aria-invalid')).toBe('true')
	await input(field, '250')
	expect(field.getAttribute('aria-invalid')).toBeNull()
	expect(error()).toBeUndefined()
	await click(button('Apply'))
	expect(changed).toHaveBeenCalledExactlyOnceWith(250)
	await waitForUi(() => expect(document.activeElement).toBe(trigger))
	expect(trigger.textContent).toBe('Row limit: Top 250 of 500')
	await click(trigger)
	await click(button('All'))
	expect(changed).toHaveBeenLastCalledWith(null)
	await waitForUi(() => expect(document.activeElement).toBe(trigger))
	expect(trigger.textContent).toBe('Row limit: All')
	await click(trigger)
	expect(button('All').getAttribute('aria-pressed')).toBe('true')
})
test('a reopened picker keeps its draft but drops the errors of the last opening', async () => {
	await act(async () =>
		root.render(
			<>
				<DateRangePicker value={null} onChange={vi.fn()} />
				<RowLimitPicker value={null} totalRows={500} onChange={vi.fn()} />
			</>
		)
	)

	await click(button('Date range: All'))
	await input(document.querySelector<HTMLInputElement>('input[type="date"]')!, '2026-01-01')
	await click(button('Apply'))
	expect(fieldErrorTexts()).toEqual(['Choose a To date.'])
	await escape(document.activeElement as HTMLElement)
	await click(button('Date range: All'))
	expect(document.querySelector<HTMLInputElement>('input[type="date"]')!.value).toBe('2026-01-01')
	expect(fieldErrorTexts()).toEqual([])
	await escape(document.activeElement as HTMLElement)

	await click(button('Row limit: All'))
	await click(button('Apply'))
	expect(fieldErrorTexts()).toEqual(['Enter a row limit.'])
	await escape(document.activeElement as HTMLElement)
	await click(button('Row limit: All'))
	expect(fieldErrorTexts()).toEqual([])
})
