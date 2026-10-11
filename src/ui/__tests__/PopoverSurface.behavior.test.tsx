// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import {
	ComboboxSurface,
	DrawerDismiss,
	MenuItem,
	MenuSurface,
	PopoverList,
	PopoverRow,
	PopoverSurface
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

async function renderMenu(variant: ComponentProps<typeof MenuSurface>['variant']) {
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

async function press(element: HTMLElement, key: string) {
	await act(async () => element.focus())
	await act(async () => {
		element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}

async function click(element: HTMLElement) {
	await act(async () => {
		element.click()
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}

/** The pick mark a row draws: a checked or empty box, a shown check, or none (an empty check slot or no mark). */
function markOf(row: Element) {
	const mark = row.querySelector('[data-checked]')
	if (!mark) return 'none'
	const checked = mark.getAttribute('data-checked') === 'true'
	if (mark.tagName.toLowerCase() === 'span') return checked ? 'box checked' : 'box empty'
	return checked ? 'tick' : 'none'
}

function FormatMenu() {
	const menu = Ariakit.useMenuStore({ defaultValues: { format: 'csv', fees: false }, defaultOpen: true })
	return (
		<Ariakit.MenuProvider store={menu}>
			<Ariakit.MenuButton>Download</Ariakit.MenuButton>
			<MenuSurface variant="actions">
				<MenuItem kind="radio" name="format" value="csv">
					.csv
				</MenuItem>
				<MenuItem kind="radio" name="format" value="json">
					.json
				</MenuItem>
				<MenuItem kind="checkbox" name="fees" hideOnClick={false}>
					Include fees
				</MenuItem>
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}

test('radio and checkbox menu items announce their checked state, move on arrows and show the pick mark', async () => {
	await act(async () => root.render(<FormatMenu />))
	const [csv, json] = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
	const fees = document.querySelector<HTMLElement>('[role="menuitemcheckbox"]')!
	expect([csv.getAttribute('aria-checked'), json.getAttribute('aria-checked')]).toEqual(['true', 'false'])
	expect([markOf(csv), markOf(json), markOf(fees)]).toEqual(['tick', 'none', 'box empty'])

	await press(csv, 'ArrowDown')
	expect(document.activeElement).toBe(json)
	await press(json, 'ArrowDown')
	expect(document.activeElement).toBe(fees)

	await click(fees)
	expect(fees.getAttribute('aria-checked')).toBe('true')
	expect(markOf(fees)).toBe('box checked')
	// The checkbox row keeps the menu open; the radio pick moves the check.
	await click(json)
	expect([csv.getAttribute('aria-checked'), json.getAttribute('aria-checked')]).toEqual(['false', 'true'])
	expect([markOf(csv), markOf(json)]).toEqual(['none', 'tick'])
})

test('a submenu row opens its nested menu on ArrowRight and closes it on ArrowLeft', async () => {
	await act(async () =>
		root.render(
			<Ariakit.MenuProvider defaultOpen>
				<Ariakit.MenuButton>Actions</Ariakit.MenuButton>
				<MenuSurface variant="actions">
					<MenuItem>Rename</MenuItem>
					<Ariakit.MenuProvider>
						<MenuItem kind="submenu">Export</MenuItem>
						<MenuSurface variant="nested" gutter={4}>
							<MenuItem>.csv</MenuItem>
						</MenuSurface>
					</Ariakit.MenuProvider>
				</MenuSurface>
			</Ariakit.MenuProvider>
		)
	)
	const exportRow = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
		(item) => item.textContent === 'Export'
	)!
	expect(exportRow.getAttribute('aria-haspopup')).toBe('menu')
	await press(exportRow, 'ArrowRight')
	expect(exportRow.getAttribute('aria-expanded')).toBe('true')
	expect(document.activeElement?.textContent).toBe('.csv')
	await press(document.activeElement as HTMLElement, 'ArrowLeft')
	expect(exportRow.getAttribute('aria-expanded')).toBe('false')
	expect(document.activeElement).toBe(exportRow)
})

test('a popover row draws its pick mark from `checked` on the Ariakit item it renders', async () => {
	await act(async () =>
		root.render(
			<Ariakit.ComboboxProvider defaultOpen>
				<Ariakit.Combobox aria-label="Chain" />
				<ComboboxSurface variant="search-results">
					<PopoverList divided>
						{['Ethereum', 'Base'].map((chain) => (
							<PopoverRow
								key={chain}
								render={<Ariakit.ComboboxItem value={chain} />}
								check="tick"
								checked={chain === 'Base'}
							>
								{chain}
							</PopoverRow>
						))}
						<PopoverRow render={<Ariakit.ComboboxItem value="Arbitrum" />} check="box" checked={false}>
							Arbitrum
						</PopoverRow>
					</PopoverList>
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>
		)
	)
	const [ethereum, base, arbitrum] = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
	expect([markOf(ethereum), markOf(base), markOf(arbitrum)]).toEqual(['none', 'tick', 'box empty'])
	// The row is still Ariakit's option: an arrow from the field highlights it.
	await press(document.querySelector<HTMLElement>('[role="combobox"]')!, 'ArrowDown')
	expect(ethereum.hasAttribute('data-active-item')).toBe(true)
})

test('a row without a render is a plain button that never submits the form around it', async () => {
	const submitted: Array<string> = []
	await act(async () =>
		root.render(
			<form
				onSubmit={(event) => {
					event.preventDefault()
					submitted.push('submit')
				}}
			>
				<PopoverRow>Add</PopoverRow>
			</form>
		)
	)
	const row = container.querySelector('button')!
	await click(row)
	expect(row.getAttribute('type')).toBe('button')
	expect(submitted).toEqual([])
})
