// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { IProtocol } from '../types'

const router = vi.hoisted(() => ({
	pathname: '/',
	asPath: '/',
	query: {} as Record<string, string>,
	push: vi.fn(async () => true),
	replace: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))

import { ChainProtocolsTable } from '../Table'

const protocol: IProtocol = {
	id: 'maker',
	name: 'Maker',
	slug: 'maker',
	chains: ['Ethereum'],
	category: 'CDP',
	tvl: { default: { tvl: 10, tvlPrevDay: 10, tvlPrevWeek: 10, tvlPrevMonth: 10 } },
	tvlChange: { change1d: 0, change7d: 0, change1m: 0 },
	mcap: null,
	tokenPrice: null,
	mcaptvl: null,
	strikeTvl: false
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	localStorage.clear()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	localStorage.clear()
})

const headers = () => [...container.querySelectorAll('th')].map((th) => th.textContent?.trim() ?? '')
const button = (name: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => accessibleName(el) === name)

async function click(element: HTMLElement) {
	await act(async () => {
		element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
		element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }))
		element.click()
		await Promise.resolve()
	})
}

test('deleting a custom column asks first and keeps the visibility of the columns after it', async () => {
	// Saved before custom columns had ids: their visibility is keyed by position.
	localStorage.setItem(
		'DEFILLAMA',
		JSON.stringify({
			CUSTOM_COLUMNS: [
				{ name: 'Alpha', formula: 'tvl', formatType: 'number' },
				{ name: 'Beta', formula: 'tvl * 2', formatType: 'number' },
				{ name: 'Gamma', formula: 'tvl * 3', formatType: 'number' }
			]
		})
	)
	localStorage.setItem(
		'ptc',
		JSON.stringify({ name: true, tvl: true, custom_formula_0: true, custom_formula_1: false, custom_formula_2: true })
	)
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<ChainProtocolsTable protocols={[protocol]} chain="All" />
			</QueryClientProvider>
		)
	)
	await waitForUi(() => expect(headers()).toContain('Alpha'))
	expect(headers()).toContain('Gamma')
	expect(headers()).not.toContain('Beta')

	await click(document.querySelector<HTMLButtonElement>('button[aria-label="Columns dropdown"]')!)
	await waitForUi(() => expect(button('Delete Alpha')).toBeDefined())
	await click(button('Delete Alpha')!)
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('"Alpha"'))
	expect(headers()).toContain('Alpha')

	const dialog = document.querySelector('[role="alertdialog"]')!
	await click([...dialog.querySelectorAll('button')].find((el) => el.textContent === 'Delete')!)

	await waitForUi(() => expect(headers()).not.toContain('Alpha'))
	expect(headers()).toContain('Gamma')
	expect(headers()).not.toContain('Beta')
})

test('closing an edited custom column asks before dropping the edit', async () => {
	localStorage.setItem(
		'DEFILLAMA',
		JSON.stringify({ CUSTOM_COLUMNS: [{ id: 'ratio', name: 'Alpha', formula: 'tvl', formatType: 'number' }] })
	)
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<ChainProtocolsTable protocols={[protocol]} chain="All" />
			</QueryClientProvider>
		)
	)
	await click(document.querySelector<HTMLButtonElement>('button[aria-label="Columns dropdown"]')!)
	await waitForUi(() => expect(button('Edit Alpha')).toBeDefined())
	await click(button('Edit Alpha')!)
	const formula = await waitForUi(() => {
		const input = document.querySelector<HTMLInputElement>('input[placeholder="e.g. revenue_30d / tvl"]')
		expect(input?.value).toBe('tvl')
		return input!
	})
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(formula, 'tvl * 4')
		formula.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => {
		formula.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
	})

	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Keep editing'))
	expect(formula.isConnected).toBe(true)
})

test('a confirmed delete hands focus to Add Custom Column, since the deleted column takes its Delete button', async () => {
	localStorage.setItem(
		'DEFILLAMA',
		JSON.stringify({ CUSTOM_COLUMNS: [{ id: 'ratio', name: 'Alpha', formula: 'tvl', formatType: 'number' }] })
	)
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<ChainProtocolsTable protocols={[protocol]} chain="All" />
			</QueryClientProvider>
		)
	)
	await click(document.querySelector<HTMLButtonElement>('button[aria-label="Columns dropdown"]')!)
	await waitForUi(() => expect(button('Delete Alpha')).toBeDefined())
	await act(async () => button('Delete Alpha')!.focus())
	await click(button('Delete Alpha')!)
	const dialog = await waitForUi(() => {
		const element = document.querySelector('[role="alertdialog"]')
		expect(element?.textContent).toContain('"Alpha"')
		return element!
	})
	await click([...dialog.querySelectorAll('button')].find((el) => el.textContent === 'Delete')!)

	await waitForUi(() => expect(document.activeElement?.textContent?.trim()).toBe('Add Custom Column'))
})
