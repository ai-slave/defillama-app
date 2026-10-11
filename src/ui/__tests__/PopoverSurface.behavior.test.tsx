// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import {
	ComboboxSurface,
	DrawerDismiss,
	PopoverSurface,
	type SurfaceOwnProps,
	MenuItem,
	MenuSurface
} from '../PopoverSurface'

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

function accessibleName(element: HTMLElement) {
	const labelledBy = element.getAttribute('aria-labelledby')
	return labelledBy ? document.getElementById(labelledBy)?.textContent : element.getAttribute('aria-label')
}

async function renderMenu(variant: SurfaceOwnProps['variant']) {
	const items = (
		<>
			<MenuItem>Download image</MenuItem>
			<MenuItem>Copy to clipboard</MenuItem>
		</>
	)
	await act(async () =>
		root.render(
			<Ariakit.MenuProvider defaultOpen>
				<Ariakit.MenuButton>Open</Ariakit.MenuButton>
				{variant === 'panel' || variant === 'list' ? (
					<MenuSurface variant={variant} heading="Export">
						{items}
					</MenuSurface>
				) : (
					<MenuSurface variant={variant}>{items}</MenuSurface>
				)}
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
] as const)('a %s menu shows its items with a titled drawer close button: %s', async (variant, hasTitleRow) => {
	const menu = await renderMenu(variant)
	expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(2)
	expect(menu.querySelector('button[aria-label="Close Export"]') != null).toBe(hasTitleRow)
	expect(accessibleName(menu) === 'Export').toBe(hasTitleRow)
})

test('a popover panel is named by its heading', async () => {
	await act(async () =>
		root.render(
			<Ariakit.PopoverProvider defaultOpen>
				<Ariakit.PopoverDisclosure>Open</Ariakit.PopoverDisclosure>
				<PopoverSurface variant="panel" heading="Saved views">
					<form>view</form>
				</PopoverSurface>
			</Ariakit.PopoverProvider>
		)
	)
	const dialog = surfaceOf('dialog')
	expect(accessibleName(dialog)).toBe('Saved views')
	expect(dialog.querySelector('button[aria-label="Close Saved views"]')).not.toBeNull()
})

test('a combobox surface defaults to the titled list drawer', async () => {
	await act(async () =>
		root.render(
			<Ariakit.ComboboxProvider defaultOpen>
				<Ariakit.Combobox />
				<ComboboxSurface heading="Chains">
					<Ariakit.ComboboxItem value="Ethereum" />
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>
		)
	)
	const listbox = surfaceOf('listbox')
	expect(accessibleName(listbox)).toBe('Chains')
	expect(listbox.querySelector('button[aria-label="Close Chains"]')).not.toBeNull()
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

function RowsPopover({ rows }: { rows: Array<string> }) {
	return (
		<Ariakit.PopoverProvider defaultOpen>
			<Ariakit.PopoverDisclosure>Open</Ariakit.PopoverDisclosure>
			<PopoverSurface variant="panel" dismiss="own">
				{rows.map((row) => (
					<button key={row} type="button">
						{row}
					</button>
				))}
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}

test('a focused control that an update removes hands focus to the popover, not the page', async () => {
	await act(async () => root.render(<RowsPopover rows={['Alpha', 'Beta']} />))
	const popover = surfaceOf('dialog')
	const beta = [...popover.querySelectorAll('button')].find((button) => button.textContent === 'Beta')!
	await act(async () => beta.focus())
	await act(async () => root.render(<RowsPopover rows={['Alpha']} />))
	expect(document.activeElement?.textContent).toBe('Alpha')
})
