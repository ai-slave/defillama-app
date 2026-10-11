// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { applyBreakpointClasses } from '~/utils/testing/breakpoints'
import { tabTo } from '~/utils/testing/keyboard'
import { waitForUi } from '~/utils/testing/waitForUi'
import { Button } from '../Button'
import { Dialog, DialogBackButton, DialogBody, DialogHeader, SideSheet } from '../Dialog'
import { Hovercard } from '../Hovercard'
import { Menu } from '../Menu'
import { NestedMenu } from '../NestedMenu'
import { ComboboxSurface, MenuItem, MenuSurface, PopoverRow, PopoverSurface } from '../PopoverSurface'
import { Definition, Tooltip } from '../Tooltip'

let root: Root
let container: HTMLDivElement
let errors: Array<string>
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	errors = []
	const logError = console.error
	vi.spyOn(console, 'error').mockImplementation((...args: Array<unknown>) => {
		errors.push(String(args[0]))
		logError(...args)
	})
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
})

const tick = () => new Promise((resolve) => setTimeout(resolve, 30))

/** A key press as the browser sends it: keydown and keyup, plus the click a native button fires on Enter. */
async function press(key: string) {
	const element = document.activeElement as HTMLElement
	await act(async () => {
		const down = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
		element.dispatchEvent(down)
		if (key === 'Enter' && !down.defaultPrevented && element instanceof HTMLButtonElement) element.click()
		element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await tick()
	})
}

const DEFINITION = 'Total value locked in the protocol'
const openTooltip = () => document.querySelector('[role="tooltip"]')?.textContent ?? null

function Term() {
	return <Definition content={DEFINITION}>TVL</Definition>
}

/** A surface's content: a definition first, then a link. */
function Terms() {
	return (
		<>
			<Term />
			<a href="/methodology">Methodology</a>
		</>
	)
}

const TABBABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'

/** Everything a Tab key reaches on the page, in order, by name. */
function tabStops() {
	return [...container.querySelectorAll<HTMLElement>(TABBABLE)].map(accessibleName)
}

function byName(name: string) {
	const match = [...document.querySelectorAll<HTMLElement>(TABBABLE)].find(
		(element) => accessibleName(element) === name
	)
	if (!match) throw new Error(`Nothing named ${name}`)
	return match
}

type Contract = {
	name: string
	ui: ReactNode
	/** The control a keyboard reader reaches to open the part. */
	trigger: string
	/** How the keyboard opens it: focus alone (a tooltip), or a key on the focused trigger. */
	opensOn: 'focus' | 'Enter' | 'ArrowDown'
	/** Tab stops on the page before opening: a button anchor is one, a text or link anchor is followed by its disclosure. */
	stops: Array<string>
	/** Where focus lands once the part opens, per its header. */
	landsOn: () => HTMLElement | null
	/** The open layer, null once closed. */
	layer: () => HTMLElement | null
	/** Whether the trigger announces aria-expanded. */
	expands: boolean
	/** Lays the page out from `sm`, where a drawer's phone title row is hidden. */
	desktop?: boolean
}

const first = (selector: string) => () => document.querySelector<HTMLElement>(selector)
const nth = (role: string, index: number) => () =>
	document.querySelectorAll<HTMLElement>(`[role="${role}"]`)[index] ?? null
const trigger = (name: string) => () => byName(name)

/** A dialog opened from an icon button with a tooltip; `back` puts a DialogBackButton, a tooltip anchor, first. */
function DialogCase({ sheet = false, back = false }: { sheet?: boolean; back?: boolean }) {
	const [open, setOpen] = useState(false)
	const Surface = sheet ? SideSheet : Dialog
	return (
		<>
			<Tooltip content="Edit view" render={<Button size="md" square aria-label="Edit" onClick={() => setOpen(true)} />}>
				<svg />
			</Tooltip>
			<Surface size="sm" open={open} onClose={() => setOpen(false)} unmountOnHide>
				<DialogHeader
					title="Edit view"
					leading={back ? <DialogBackButton label="Back" onClick={() => setOpen(false)} /> : null}
				/>
				<DialogBody>
					<Terms />
				</DialogBody>
			</Surface>
		</>
	)
}

const CONTRACTS: Array<Contract> = [
	{
		name: 'Tooltip on a control',
		ui: (
			<Tooltip content="Open website" render={<Button size="md" square aria-label="Website" />}>
				<svg />
			</Tooltip>
		),
		trigger: 'Website',
		opensOn: 'focus',
		stops: ['Website'],
		landsOn: trigger('Website'),
		layer: first('[role="tooltip"]'),
		expands: false
	},
	{
		name: 'Definition',
		ui: <Term />,
		trigger: 'TVL',
		opensOn: 'focus',
		stops: ['TVL'],
		landsOn: trigger('TVL'),
		layer: first('[role="tooltip"]'),
		expands: false
	},
	{
		name: 'Hovercard with a button anchor',
		ui: (
			<Hovercard content={<Terms />} render={<button type="button" />}>
				Chains
			</Hovercard>
		),
		trigger: 'Chains',
		opensOn: 'Enter',
		stops: ['Chains'],
		landsOn: trigger('TVL'),
		layer: first('[role="dialog"]'),
		expands: true
	},
	{
		name: 'Hovercard with a text anchor',
		ui: <Hovercard content={<Terms />}>3 chains</Hovercard>,
		trigger: 'Show details',
		opensOn: 'Enter',
		stops: ['3 chains', 'Show details'],
		landsOn: trigger('TVL'),
		layer: first('[role="dialog"]'),
		expands: true
	},
	{
		name: 'Hovercard with a link anchor',
		ui: (
			<Hovercard content={<Terms />} render={<a href="/chains" />} showOnClick={false}>
				Chains
			</Hovercard>
		),
		trigger: 'Show details',
		opensOn: 'Enter',
		stops: ['Chains', 'Show details'],
		landsOn: trigger('TVL'),
		layer: first('[role="dialog"]'),
		expands: true
	},
	{
		name: 'Menu',
		ui: <Menu name="Websites" options={['Docs', 'Blog']} onItemClick={() => {}} />,
		trigger: 'Websites',
		opensOn: 'Enter',
		stops: ['Websites'],
		landsOn: first('[role="menuitem"]'),
		layer: first('[role="menu"]'),
		expands: true
	},
	{
		name: 'MenuSurface behind an icon button with a tooltip',
		ui: (
			<Ariakit.MenuProvider>
				<Tooltip
					content="More actions"
					render={<Ariakit.MenuButton render={<Button size="md" square aria-label="More" />} />}
				>
					<svg />
				</Tooltip>
				<MenuSurface variant="actions">
					<MenuItem>Rename</MenuItem>
				</MenuSurface>
			</Ariakit.MenuProvider>
		),
		trigger: 'More',
		opensOn: 'Enter',
		stops: ['More'],
		landsOn: first('[role="menuitem"]'),
		layer: first('[role="menu"]'),
		expands: true
	},
	{
		name: 'PopoverSurface panel',
		ui: (
			<Ariakit.PopoverProvider>
				<Ariakit.PopoverDisclosure render={<Button size="md" />}>Filters</Ariakit.PopoverDisclosure>
				<PopoverSurface variant="panel" heading="Filters">
					<Terms />
				</PopoverSurface>
			</Ariakit.PopoverProvider>
		),
		trigger: 'Filters',
		opensOn: 'Enter',
		stops: ['Filters'],
		landsOn: () => byName('Close Filters'),
		layer: first('[role="dialog"]'),
		expands: true
	},
	{
		name: 'PopoverSurface panel on desktop',
		ui: (
			<Ariakit.PopoverProvider>
				<Ariakit.PopoverDisclosure render={<Button size="md" />}>Filters</Ariakit.PopoverDisclosure>
				<PopoverSurface variant="panel" heading="Filters">
					<Terms />
				</PopoverSurface>
			</Ariakit.PopoverProvider>
		),
		trigger: 'Filters',
		opensOn: 'Enter',
		stops: ['Filters'],
		landsOn: trigger('TVL'),
		layer: first('[role="dialog"]'),
		expands: true,
		desktop: true
	},
	{
		name: 'ComboboxSurface',
		ui: (
			<Ariakit.ComboboxProvider>
				<Ariakit.Combobox aria-label="Chain" />
				<ComboboxSurface variant="search-results">
					<PopoverRow render={<Ariakit.ComboboxItem value="Ethereum" />}>Ethereum</PopoverRow>
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>
		),
		trigger: 'Chain',
		opensOn: 'ArrowDown',
		stops: ['Chain'],
		landsOn: trigger('Chain'),
		layer: first('[role="listbox"]'),
		expands: true
	},
	{
		name: 'Dialog',
		ui: <DialogCase />,
		trigger: 'Edit',
		opensOn: 'Enter',
		stops: ['Edit'],
		landsOn: () => byName('Close dialog'),
		layer: first('[role="dialog"]'),
		expands: false
	},
	{
		name: 'Dialog that starts on its back button',
		ui: <DialogCase back />,
		trigger: 'Edit',
		opensOn: 'Enter',
		stops: ['Edit'],
		landsOn: () => byName('Back'),
		layer: first('[role="dialog"]'),
		expands: false
	},
	{
		name: 'SideSheet',
		ui: <DialogCase sheet />,
		trigger: 'Edit',
		opensOn: 'Enter',
		stops: ['Edit'],
		landsOn: () => byName('Close dialog'),
		layer: first('[role="dialog"]'),
		expands: false
	},
	{
		name: 'NestedMenu',
		ui: (
			<NestedMenu label="Filters">
				<MenuItem>Reset</MenuItem>
			</NestedMenu>
		),
		trigger: 'Filters',
		opensOn: 'Enter',
		stops: ['Filters'],
		landsOn: first('[role="menuitem"]'),
		layer: first('[role="menu"]'),
		expands: true
	}
]

test.each(CONTRACTS)(
	'$name: opens by keyboard with its definitions closed, and one Escape closes it back to its trigger',
	async (part) => {
		// happy-dom's window is 1024px wide, past `sm`, where a drawer's phone title row hides.
		if (part.desktop) await applyBreakpointClasses(['sm:hidden'])
		await act(async () => root.render(part.ui))
		expect(tabStops()).toEqual(part.stops)
		const opener = byName(part.trigger)
		await tabTo(opener)
		if (part.opensOn !== 'focus') await press(part.opensOn)
		await waitForUi(() => expect(part.layer()).not.toBeNull())
		expect(document.activeElement).toBe(part.landsOn())
		expect(opener.getAttribute('aria-expanded')).toBe(part.expands ? 'true' : null)
		// A tooltip is the layer itself; any other part opens with every tooltip closed: its trigger's, and the one on
		// the control it focused.
		expect(openTooltip()).toBe(part.opensOn === 'focus' ? part.layer()!.textContent : null)

		await press('Escape')
		await waitForUi(() => expect(part.layer()).toBeNull())
		expect(document.activeElement).toBe(opener)
		// Focus handed back to a trigger with a tooltip leaves it closed, and the trigger keeps its focus ring.
		expect(openTooltip()).toBeNull()
		await waitForUi(() => expect(opener.dataset.focusVisible).toBe('true'))
		expect(opener.getAttribute('aria-expanded')).toBe(part.expands ? 'false' : null)

		await act(async () => root.render(null))
		expect(errors).toEqual([])
	}
)

const SURFACES_WITH_TERMS = CONTRACTS.filter((part) =>
	['Hovercard with a button anchor', 'PopoverSurface panel', 'Dialog', 'SideSheet'].includes(part.name)
)

test.each(SURFACES_WITH_TERMS)(
	'$name: the first Escape closes a definition opened inside it, the second the surface',
	async (part) => {
		await act(async () => root.render(part.ui))
		const opener = byName(part.trigger)
		await tabTo(opener)
		await press('Enter')
		await waitForUi(() => expect(part.layer()).not.toBeNull())
		// The reader tabs to the link and back onto the definition.
		await tabTo(byName('Methodology'))
		await tabTo(byName('TVL'))
		await waitForUi(() => expect(openTooltip()).toBe(DEFINITION))

		await press('Escape')
		await waitForUi(() => expect(openTooltip()).toBeNull())
		expect(part.layer()).not.toBeNull()
		expect(document.activeElement).toBe(byName('TVL'))

		await press('Escape')
		await waitForUi(() => expect(part.layer()).toBeNull())
		expect(document.activeElement).toBe(opener)
		expect(errors).toEqual([])
	}
)

function DialogHosting({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false)
	return (
		<>
			<Button size="md" onClick={() => setOpen(true)}>
				Edit
			</Button>
			<Dialog size="sm" open={open} onClose={() => setOpen(false)} unmountOnHide>
				<DialogHeader title="Edit view" />
				<DialogBody>{children}</DialogBody>
			</Dialog>
		</>
	)
}

const STACKS: Array<{ name: string; ui: ReactNode; openers: Array<string>; layers: Array<() => HTMLElement | null> }> =
	[
		{
			name: 'a picker in a dialog',
			ui: (
				<DialogHosting>
					<Ariakit.PopoverProvider>
						<Ariakit.PopoverDisclosure render={<Button size="md" />}>Chains</Ariakit.PopoverDisclosure>
						<PopoverSurface variant="panel" heading="Chains">
							<input aria-label="Search chains" />
						</PopoverSurface>
					</Ariakit.PopoverProvider>
				</DialogHosting>
			),
			openers: ['Edit', 'Chains'],
			layers: [nth('dialog', 0), nth('dialog', 1)]
		},
		{
			name: 'a hovercard in a dialog',
			ui: (
				<DialogHosting>
					<Hovercard content={<Terms />} render={<button type="button" />}>
						Chains
					</Hovercard>
				</DialogHosting>
			),
			openers: ['Edit', 'Chains'],
			layers: [nth('dialog', 0), nth('dialog', 1)]
		},
		{
			name: 'a submenu in a nested menu',
			ui: (
				<NestedMenu label="Filters">
					<NestedMenu label="Chains">
						<MenuItem>Ethereum</MenuItem>
					</NestedMenu>
				</NestedMenu>
			),
			openers: ['Filters', 'Chains'],
			layers: [nth('menu', 0), nth('menu', 1)]
		}
	]

test.each(STACKS)('$name: each Escape closes the innermost layer and returns focus to its opener', async (stack) => {
	await act(async () => root.render(stack.ui))
	for (const [index, name] of stack.openers.entries()) {
		await tabTo(byName(name))
		await press('Enter')
		await waitForUi(() => expect(stack.layers[index]()).not.toBeNull())
	}
	for (let index = stack.openers.length - 1; index >= 0; index--) {
		const opener = byName(stack.openers[index])
		await press('Escape')
		await waitForUi(() => expect(stack.layers[index]()).toBeNull())
		// Every layer under it stays open.
		expect(stack.layers.slice(0, index).filter((layer) => layer() === null)).toEqual([])
		expect(document.activeElement).toBe(opener)
		expect(opener.getAttribute('aria-expanded')).not.toBe('true')
	}
	await act(async () => root.render(null))
	expect(errors).toEqual([])
})

function RemovableFilter() {
	const [open, setOpen] = useState(false)
	const [kept, setKept] = useState(true)
	return (
		<>
			<Button size="md" onClick={() => setOpen(true)}>
				Filters
			</Button>
			<Dialog size="sm" open={open} onClose={() => setOpen(false)} unmountOnHide>
				<DialogHeader title="Filters" leading={<DialogBackButton label="Back" onClick={() => setOpen(false)} />} />
				<DialogBody>
					{kept ? (
						<Button size="md" onClick={() => setKept(false)}>
							Remove filter
						</Button>
					) : (
						'No filters'
					)}
				</DialogBody>
			</Dialog>
		</>
	)
}

test('the lost-focus net hands focus to a tooltip anchor without opening its tooltip, and one Escape closes', async () => {
	await act(async () => root.render(<RemovableFilter />))
	const opener = byName('Filters')
	await tabTo(opener)
	await press('Enter')
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
	await tabTo(byName('Remove filter'))
	await press('Enter')
	await waitForUi(() => expect(document.activeElement).toBe(byName('Back')))
	expect(openTooltip()).toBeNull()

	await press('Escape')
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
	expect(document.activeElement).toBe(opener)
	expect(errors).toEqual([])
})

test('a control with a tooltip stays closed when code focuses it and opens when the reader tabs to it', async () => {
	await act(async () =>
		root.render(
			<Tooltip content="Open website" render={<Button size="md" square aria-label="Website" />}>
				<svg />
			</Tooltip>
		)
	)
	const website = byName('Website')
	await act(async () => website.focus())
	expect(openTooltip()).toBeNull()
	await act(async () => website.blur())
	await tabTo(website)
	await waitForUi(() => expect(openTooltip()).toBe('Open website'))
})
