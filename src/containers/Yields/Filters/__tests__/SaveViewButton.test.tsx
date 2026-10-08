// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SaveViewButton } from '../index'

const router = vi.hoisted(() => ({ pathname: '/yields', asPath: '/yields', query: {}, push: vi.fn() }))
vi.mock('next/router', () => ({ useRouter: () => router }))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	localStorage.clear()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const button = (name: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)
// The storage store re-renders its readers a task after a write.
const nextTask = () => new Promise((resolve) => setTimeout(resolve))

async function openWithViews(names: Array<string>) {
	await act(async () => root.render(<SaveViewButton currentFilters={{ chain: 'Ethereum' }} />))
	await act(async () => container.querySelector('button')!.click())
	const label = [...document.querySelectorAll('label')].find((el) => el.textContent === 'Save current view')!
	const field = document.getElementById(label.htmlFor) as HTMLInputElement
	for (const name of names) {
		await act(async () => {
			const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
			setValue.call(field, name)
			field.dispatchEvent(new Event('input', { bubbles: true }))
		})
		await act(async () => {
			field.form!.requestSubmit()
			await nextTask()
		})
	}
	return field
}

async function deleteFocused(name: string) {
	await act(async () => {
		button(`Delete ${name}`)!.focus()
		button(`Delete ${name}`)!.click()
		await nextTask()
	})
}

test('deleting a saved view hands focus to the next view’s delete, else the previous one’s', async () => {
	await openWithViews(['Alpha', 'Beta', 'Gamma'])
	await deleteFocused('Beta')
	expect(button('Delete Beta')).toBeNull()
	expect(document.activeElement).toBe(button('Delete Gamma'))
	await deleteFocused('Gamma')
	expect(document.activeElement).toBe(button('Delete Alpha'))
})

test('deleting the last saved view hands focus to the popover’s name field', async () => {
	const field = await openWithViews(['Alpha'])
	await deleteFocused('Alpha')
	expect(document.body.textContent).toContain('No saved views yet')
	expect(document.activeElement).toBe(field)
})

test('a reopened popover drops the error of the last opening', async () => {
	await act(async () => root.render(<SaveViewButton currentFilters={{ chain: 'Ethereum' }} />))
	const trigger = container.querySelector('button')!
	await act(async () => trigger.click())
	await act(async () => document.querySelector('form')!.requestSubmit())
	const errorTexts = () => [...document.querySelectorAll('.text-error')].map((el) => el.textContent)
	expect(errorTexts()).toEqual(['Enter a view name.'])
	await act(async () =>
		document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
	)
	await act(async () => trigger.click())
	expect(document.querySelector('form')).not.toBeNull()
	expect(errorTexts()).toEqual([])
})
