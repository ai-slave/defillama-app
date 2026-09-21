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

// The drawer contract has three pieces a raw Ariakit call site used to wire by
// hand: the surface's phone height mode, the bottom-sheet wrapper (with scrim),
// and the close button. These assert each variant produces the right triple.
const CONTENT_SIZED = 'max-sm:max-h-[calc(100dvh-80px)]'
const RESERVED_HEIGHT = 'max-sm:h-[calc(100dvh-80px)]'
const DRAWER_WRAPPER = 'max-sm:fixed!'
const SCRIM = 'max-sm:before:bg-screen-dim'

function surfaceOf(role: string) {
	const surface = document.querySelector<HTMLElement>(`[role="${role}"]`)
	expect(surface).not.toBeNull()
	return surface!
}

async function renderMenu(variant: PopoverSurfaceVariant, className?: string) {
	await act(async () =>
		root.render(
			<Ariakit.MenuProvider defaultOpen>
				<Ariakit.MenuButton>Open</Ariakit.MenuButton>
				<MenuSurface variant={variant} className={className}>
					<MenuItem>Download image</MenuItem>
					<MenuItem>Copy to clipboard</MenuItem>
				</MenuSurface>
			</Ariakit.MenuProvider>
		)
	)
	return surfaceOf('menu')
}

test('actions menu fits its content and has no close button', async () => {
	const menu = await renderMenu('actions')
	expect(menu.className).toContain(CONTENT_SIZED)
	expect(menu.className).not.toContain(RESERVED_HEIGHT)
	expect(menu.querySelector('button[aria-label="Close menu"]')).toBeNull()
	expect(menu.parentElement!.className).toContain(DRAWER_WRAPPER)
	expect(menu.parentElement!.className).toContain(SCRIM)
	expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(2)
})

test('panel menu stays content-sized but gains a close button', async () => {
	const menu = await renderMenu('panel')
	expect(menu.className).toContain(CONTENT_SIZED)
	expect(menu.querySelector('button[aria-label="Close menu"]')).not.toBeNull()
})

test('list menu reserves the drawer height and has a close button', async () => {
	const menu = await renderMenu('list')
	expect(menu.className).toContain(RESERVED_HEIGHT)
	expect(menu.className).not.toContain(CONTENT_SIZED)
	expect(menu.querySelector('button[aria-label="Close menu"]')).not.toBeNull()
})

test('className is appended for layout and rows carry the touch-target recipe', async () => {
	const menu = await renderMenu('actions', 'z-50 w-44')
	expect(menu.className).toMatch(/ z-50 w-44$/)
	const row = menu.querySelector<HTMLElement>('[role="menuitem"]')!
	expect(row.className).toContain('max-sm:min-h-11')
	expect(row.className).toContain('hover:bg-hover-row')
})

test('popover surface applies the same contract to Ariakit.Popover', async () => {
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
	const popover = surfaceOf('dialog')
	expect(popover.className).toContain(CONTENT_SIZED)
	expect(popover.parentElement!.className).toContain(DRAWER_WRAPPER)
	expect(popover.querySelector('button[aria-label="Close saved views"]')).not.toBeNull()
})

test('combobox surface defaults to the list drawer', async () => {
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
	const listbox = surfaceOf('listbox')
	expect(listbox.className).toContain(RESERVED_HEIGHT)
	expect(listbox.parentElement!.className).toContain(DRAWER_WRAPPER)
	expect(listbox.querySelector('button[aria-label="Close options"]')).not.toBeNull()
})

test('nested flyout uses the scrim-free wrapper, slides from the right and has no close button', async () => {
	await act(async () =>
		root.render(
			<Ariakit.MenuProvider defaultOpen>
				<Ariakit.MenuButton>Open</Ariakit.MenuButton>
				<MenuSurface variant="nested" gutter={4}>
					<MenuItem row="none" className="custom-row">
						Move here
					</MenuItem>
				</MenuSurface>
			</Ariakit.MenuProvider>
		)
	)
	const menu = surfaceOf('menu')
	expect(menu.className).toContain('max-sm:drawer-to-left')
	expect(menu.className).not.toContain(' max-sm:drawer ')
	expect(menu.parentElement!.className).toContain(DRAWER_WRAPPER)
	expect(menu.parentElement!.className).not.toContain(SCRIM)
	expect(menu.querySelector('button[aria-label]')).toBeNull()
	const row = menu.querySelector<HTMLElement>('[role="menuitem"]')!
	expect(row.className).toBe('custom-row')
})

test('wrapperClassName extends the positioning wrapper and tree rows swap the recipe', async () => {
	await act(async () =>
		root.render(
			<Ariakit.ComboboxProvider defaultOpen>
				<Ariakit.Combobox />
				<ComboboxSurface wrapperClassName="w-full!">
					<Ariakit.ComboboxItem value="Ethereum" />
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>
		)
	)
	const listbox = surfaceOf('listbox')
	expect(listbox.parentElement!.className).toMatch(new RegExp(`^${DRAWER_WRAPPER.replace('!', '\\!')}.* w-full!$`))
	await act(async () => root.unmount())
	root = createRoot(container)
	await act(async () =>
		root.render(
			<Ariakit.MenuProvider defaultOpen>
				<Ariakit.MenuButton>Open</Ariakit.MenuButton>
				<MenuSurface variant="actions">
					<MenuItem row="tree" className="pl-8">
						Aave V3
					</MenuItem>
				</MenuSurface>
			</Ariakit.MenuProvider>
		)
	)
	const row = surfaceOf('menu').querySelector<HTMLElement>('[role="menuitem"]')!
	expect(row.className).toContain('group relative')
	expect(row.className).not.toContain('px-3')
	expect(row.className).toMatch(/ pl-8$/)
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
test('surfaces unmount their content while closed unless a caller opts out', async () => {
	await act(async () =>
		root.render(
			<Ariakit.ComboboxProvider defaultValue="1%">
				<Ariakit.ComboboxSelect>Threshold</Ariakit.ComboboxSelect>
				<ComboboxSurface>
					<Ariakit.ComboboxItem value="1%" />
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>
		)
	)
	expect(document.querySelector('[role="option"]')).toBeNull()
	await act(async () => root.unmount())
	root = createRoot(container)
	await act(async () =>
		root.render(
			<Ariakit.ComboboxProvider defaultValue="1%">
				<Ariakit.ComboboxSelect>Threshold</Ariakit.ComboboxSelect>
				<ComboboxSurface unmountOnHide={false}>
					<Ariakit.ComboboxItem value="1%" />
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>
		)
	)
	expect(document.querySelector('[role="option"]')).not.toBeNull()
})
