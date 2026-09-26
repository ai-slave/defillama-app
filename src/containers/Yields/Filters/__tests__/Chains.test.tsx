// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FilterByChain } from '../Chains'

const router = vi.hoisted(() => ({
	pathname: '/yields',
	asPath: '/yields',
	query: {} as Record<string, string | Array<string>>,
	push: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))

const CHAINS = ['Ethereum', 'Solana', 'Base']
const EVM_CHAINS = ['Ethereum', 'Base']

let container: HTMLDivElement
let root: Root

const picker = () => <FilterByChain chainList={CHAINS} evmChains={EVM_CHAINS} />

// Shallow routing re-renders the page with the new query; the mock does the same.
router.push.mockImplementation(async ({ query }: { query: Record<string, string | Array<string>> }) => {
	router.query = query
	await act(async () => root.render(picker()))
})

async function click(element: HTMLElement) {
	await act(async () => {
		element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
		element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }))
		element.click()
		await Promise.resolve()
	})
}

const trigger = () => document.querySelector<HTMLButtonElement>('button[role="combobox"]')!
const button = (text: string) => [...document.querySelectorAll('button')].find((b) => b.textContent === text)!
const selected = () =>
	[...document.querySelectorAll('[role="option"]')]
		.filter((option) => option.getAttribute('aria-selected') === 'true')
		// Each option row also holds its "Only" button.
		.map((option) => option.textContent?.replace(/Only$/, ''))

beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	router.query = {}
})

test('keeps every chain on Select All from the default view', async () => {
	await act(async () => root.render(picker()))
	await click(trigger())

	await click(button('Select All'))
	expect(router.query).toEqual({})
	expect(selected()).toEqual(['Ethereum', 'Solana', 'Base'])
})

test('checks the real EVM chains, and Select All returns to every chain', async () => {
	await act(async () => root.render(picker()))
	await click(trigger())

	await click(button('Only EVM chains'))
	expect(router.query).toEqual({ excludeChain: 'Solana' })
	expect(selected()).toEqual(['Ethereum', 'Base'])

	await click(button('Select All'))
	expect(router.query).toEqual({})
	expect(selected()).toEqual(['Ethereum', 'Solana', 'Base'])
})
