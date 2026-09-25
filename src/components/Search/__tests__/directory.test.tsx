// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import Directory from '~/pages/directory'

vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

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

const protocols = Array.from({ length: 25 }, (_, i) => ({
	name: `Protocol ${i + 1}`,
	logo: '',
	route: `https://example.com/${i + 1}`
}))

async function search(value: string) {
	const input = container.querySelector('input')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('directory results remain inline and visible through filtering, empty results, and clearing', async () => {
	await act(async () => root.render(<Directory protocols={protocols} />))
	const list = container.querySelector('[role="listbox"]')!
	expect(container.querySelector('[role="dialog"]')).toBeNull()
	expect(list.querySelectorAll('[role="option"]')).toHaveLength(21)
	await search('no-match')
	expect(list.textContent).toContain('No results found')
	expect(list.hasAttribute('hidden')).toBe(false)
	await search('Protocol 25')
	expect(list.querySelectorAll('[role="option"]')).toHaveLength(1)
	await search('')
	expect(list.querySelectorAll('[role="option"]')).toHaveLength(21)
})

test('see more expands results and a new query restores the page size', async () => {
	await act(async () => root.render(<Directory protocols={protocols} />))
	const more = [...container.querySelectorAll<HTMLElement>('[role="option"]')].find(
		(el) => el.textContent === 'See more...'
	)!
	await act(async () => more.click())
	expect(container.querySelectorAll('[role="option"]')).toHaveLength(25)
	await search('Protocol')
	expect(container.querySelectorAll('[role="option"]')).toHaveLength(21)
})
