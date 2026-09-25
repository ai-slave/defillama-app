// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { MenuItem, MenuSurface } from '../MenuSurface'
import { ComboboxSurface, DrawerDismiss, PopoverSurface, type PopoverSurfaceVariant } from '../PopoverSurface'

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

function surfaceOf(role: string) {
	const surface = document.querySelector<HTMLElement>(`[role="${role}"]`)
	expect(surface).not.toBeNull()
	return surface!
}

async function renderMenu(variant: PopoverSurfaceVariant) {
	await act(async () =>
		root.render(
			<Ariakit.MenuProvider defaultOpen>
				<Ariakit.MenuButton>Open</Ariakit.MenuButton>
				<MenuSurface variant={variant}>
					<MenuItem>Download image</MenuItem>
					<MenuItem>Copy to clipboard</MenuItem>
				</MenuSurface>
			</Ariakit.MenuProvider>
		)
	)
	return surfaceOf('menu')
}

test.each([
	['actions', false],
	['panel', true],
	['list', true],
	['nested', false]
] as const)('a %s menu shows its items with a drawer close button: %s', async (variant, hasDismiss) => {
	const menu = await renderMenu(variant)
	expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(2)
	expect(menu.querySelector('button[aria-label="Close menu"]') != null).toBe(hasDismiss)
})

test('a popover panel labels its close button', async () => {
	await act(async () =>
		root.render(
			<Ariakit.PopoverProvider defaultOpen>
				<Ariakit.PopoverDisclosure>Open</Ariakit.PopoverDisclosure>
				<PopoverSurface variant="panel" dismissLabel="Close saved views">
					<form>view</form>
				</PopoverSurface>
			</Ariakit.PopoverProvider>
		)
	)
	expect(surfaceOf('dialog').querySelector('button[aria-label="Close saved views"]')).not.toBeNull()
})

test('a combobox surface defaults to the list drawer with a close button', async () => {
	await act(async () =>
		root.render(
			<Ariakit.ComboboxProvider defaultOpen>
				<Ariakit.Combobox />
				<ComboboxSurface>
					<Ariakit.ComboboxItem value="Ethereum" />
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>
		)
	)
	expect(surfaceOf('listbox').querySelector('button[aria-label="Close options"]')).not.toBeNull()
})

test('dismiss="own" lets a headed panel place the close button inside its header', async () => {
	await act(async () =>
		root.render(
			<Ariakit.PopoverProvider defaultOpen>
				<Ariakit.PopoverDisclosure>Open</Ariakit.PopoverDisclosure>
				<PopoverSurface variant="panel" dismiss="own">
					<div data-testid="header">
						<span>APY view</span>
						<DrawerDismiss label="Close APY view" />
					</div>
				</PopoverSurface>
			</Ariakit.PopoverProvider>
		)
	)
	const popover = surfaceOf('dialog')
	const buttons = popover.querySelectorAll('button[aria-label]')
	expect(buttons).toHaveLength(1)
	expect(buttons[0].closest('[data-testid="header"]')).not.toBeNull()
})

test('search results have no drawer close button and unmount on close', async () => {
	let store: Ariakit.ComboboxStore
	function Harness() {
		store = Ariakit.useComboboxStore({ defaultOpen: true })
		return (
			<Ariakit.ComboboxProvider store={store}>
				<Ariakit.Combobox aria-label="Search" />
				<ComboboxSurface variant="search-results" sameWidth>
					<Ariakit.ComboboxItem value="Ethereum" />
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>
		)
	}
	await act(async () => root.render(<Harness />))
	expect(surfaceOf('listbox').querySelector('button')).toBeNull()
	await act(async () => store!.hide())
	expect(document.querySelector('[role="option"]')).toBeNull()
	await act(async () => store!.show())
	expect(surfaceOf('listbox').textContent).toContain('Ethereum')
})
