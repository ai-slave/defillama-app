// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardTestProvider, type DashboardTestState } from '~/utils/testing/dashboardContext'
import { installDownloadSink } from '~/utils/testing/downloadSink'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import type { Dashboard } from '../../dashboardTypes'
import { DashboardCardContext, type DashboardCardContextValue } from '../DashboardCardContext'
import { ProCardEditControls, ProCardOverflowMenu } from '../ProCardActions'
const writeText = vi.fn()
const bindItemField = vi.fn()
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test' }) }))
const session = installSubscriberSession('u1', { resolved: true })
const downloads = installDownloadSink()
const publicDashboard: Dashboard = {
	id: 'dashboard-1',
	slug: 'fees-dash',
	visibility: 'public',
	data: { items: [], dashboardName: 'Fees' },
	created: '2026-01-01T00:00:00Z',
	updated: '2026-01-01T00:00:00Z'
}
const chartItem: DashboardItemConfig = {
	id: 'chart-1',
	kind: 'chart',
	subjectType: 'protocol',
	protocol: 'aave',
	type: 'fees',
	height: 'tall'
}
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	bindItemField.mockClear()
	writeText.mockReset().mockResolvedValue(undefined)
	layoutControls.onColSpanChange.mockClear()
	layoutControls.onHeightChange.mockClear()
	layoutControls.onMove.mockClear()
	Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
/** Renders `node` inside a signed-in subscriber's dashboard with the given dashboard state. */
async function render(node: ReactNode, state: DashboardTestState = {}) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardTestProvider {...state}>{node}</DashboardTestProvider>
			</session.Wrapper>
		)
	)
}
const readOnly = { mode: 'view', permissions: { isReadOnly: true } } as const
const publicCard: DashboardTestState = { dashboard: { currentDashboard: publicDashboard }, items: [chartItem] }
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function openMenu() {
	await act(async () => (container.querySelector('[aria-label="More actions"]') as HTMLButtonElement).click())
}
function menuItems() {
	return Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
}
async function clickMenuItem(label: string) {
	await act(async () =>
		menuItems()
			.find((node) => node.textContent === label)!
			.click()
	)
}
const CARD_CONTEXT_VALUE = { itemId: 'chart-1' }
function withCard(children: ReactNode) {
	return <DashboardCardContext.Provider value={CARD_CONTEXT_VALUE}>{children}</DashboardCardContext.Provider>
}
function menuRadios() {
	return Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]'))
}
const layoutControls = {
	colSpan: 1 as const,
	colSpanOptions: [0.5, 1, 1.5, 2] as const,
	onColSpanChange: vi.fn(),
	height: 'default' as const,
	heightOptions: ['compact', 'default', 'tall'] as const,
	onHeightChange: vi.fn(),
	canMoveUp: false,
	canMoveDown: true,
	onMove: vi.fn()
}
const LAYOUT_CARD_CONTEXT: DashboardCardContextValue = { itemId: 'chart-1', layout: layoutControls }
const NO_HEIGHT_LAYOUT_CARD_CONTEXT: DashboardCardContextValue = {
	itemId: 'chart-1',
	layout: { ...layoutControls, height: null, heightOptions: [] }
}
const onRemoveCard = vi.fn()
const REMOVABLE_CARD_CONTEXT: DashboardCardContextValue = { itemId: 'chart-1', onRemove: onRemoveCard }
function withLayoutCard(children: ReactNode, value: DashboardCardContextValue = LAYOUT_CARD_CONTEXT) {
	return <DashboardCardContext.Provider value={value}>{children}</DashboardCardContext.Provider>
}
test('readonly allows exports but hides duplicate and edit controls', async () => {
	await render(
		<>
			<ProCardEditControls>
				<button type="button">Edit</button>
			</ProCardEditControls>
			<ProCardOverflowMenu image={{ chartInstance: () => null }} onDuplicate={vi.fn()} />
		</>,
		readOnly
	)
	expect(container.textContent).not.toContain('Edit')
	await openMenu()
	expect(document.body.textContent).toContain('Download image')
	expect(document.body.textContent).not.toContain('Duplicate')
})
test('has no trigger without actions and respects hidden duplicate', async () => {
	await render(<ProCardOverflowMenu />)
	expect(container.querySelector('button')).toBeNull()
	await render(<ProCardOverflowMenu onDuplicate={vi.fn()} />)
	expect(container.querySelector('[aria-label="More actions"]')).not.toBeNull()
	await render(<ProCardOverflowMenu onDuplicate={vi.fn()} />, { permissions: { hideDuplicateButton: true } })
	expect(container.querySelector('button')).toBeNull()
})
test('Download CSV saves the prepared rows for a subscriber', async () => {
	const prepareCsv = () => ({ filename: 'Example', rows: [['value'], [1]] })
	await render(<ProCardOverflowMenu csv={{ prepareCsv }} />)
	await openMenu()
	await waitForUi(() =>
		expect(
			menuItems()
				.find((node) => node.textContent === 'Download CSV')
				?.getAttribute('aria-disabled')
		).not.toBe('true')
	)
	await clickMenuItem('Download CSV')
	await waitForUi(() => expect(downloads.map((download) => download.filename)).toEqual(['example.csv']))
	expect(await downloads[0]!.blob.text()).toBe('value\n1')
})
test('offers a card permalink and an embed snippet for cards on a public dashboard', async () => {
	await render(withCard(<ProCardOverflowMenu image={{ chartInstance: () => null }} />), { ...publicCard, ...readOnly })
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toEqual([
		'Download image',
		'Copy image',
		'Copy link to card',
		'Embed card…'
	])
	await clickMenuItem('Copy link to card')
	expect(writeText).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}/pro/fees-dash#item=chart-1`)
	await openMenu()
	await clickMenuItem('Embed card…')
	const textarea = document.body.querySelector<HTMLTextAreaElement>('textarea[aria-label="Embed code"]')
	expect(textarea?.value).toBe(
		'<iframe src="https://defillama.com/pro/embed/fees-dash?item=chart-1&theme=dark" width="100%" height="558" style="border:0" loading="lazy"></iframe>'
	)
	await act(async () =>
		Array.from(document.body.querySelectorAll('[role="radiogroup"] label'))
			.find((node) => node.textContent === 'Light')!
			.querySelector<HTMLInputElement>('input[type="radio"]')!
			.click()
	)
	expect(textarea?.value).toContain('theme=light')
	await act(async () =>
		Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
			.find((node) => node.textContent?.trim() === 'Copy code')!
			.click()
	)
	expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('theme=light'))
})
test('shows the trigger for a shareable card even without exports, before duplicate', async () => {
	await render(withCard(<ProCardOverflowMenu onDuplicate={vi.fn()} />), publicCard)
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toEqual(['Copy link to card', 'Embed card…', 'Duplicate'])
	expect(document.body.querySelectorAll('[role="separator"]')).toHaveLength(1)
})
test('hides card sharing without a card context or on a private dashboard', async () => {
	await render(<ProCardOverflowMenu image={{ chartInstance: () => null }} />, publicCard)
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toEqual(['Download image', 'Copy image'])
	await render(<ProCardOverflowMenu />, publicCard)
	expect(container.querySelector('button')).toBeNull()
	const privateCard: DashboardTestState = {
		...publicCard,
		dashboard: { currentDashboard: { ...publicDashboard, visibility: 'private' } }
	}
	await render(withCard(<ProCardOverflowMenu image={{ chartInstance: () => null }} />), privateCard)
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toEqual(['Download image', 'Copy image'])
	await render(withCard(<ProCardOverflowMenu />), privateCard)
	expect(container.querySelector('button')).toBeNull()
})
test('offers the card widths and heights with the current ones checked, and reports the one picked', async () => {
	await render(withLayoutCard(<ProCardOverflowMenu />))
	await openMenu()
	expect(document.body.querySelectorAll('[role="group"]')).toHaveLength(3)
	expect(document.body.textContent).toContain('Width')
	expect(document.body.textContent).toContain('Height')
	expect(document.body.textContent).toContain('Move')
	expect(menuRadios().map((node) => node.textContent)).toEqual([
		'Quarter width',
		'Half width',
		'Three-quarter width',
		'Full width',
		'Compact',
		'Default',
		'Tall'
	])
	expect(menuRadios().map((node) => node.getAttribute('aria-checked'))).toEqual([
		'false',
		'true',
		'false',
		'false',
		'false',
		'true',
		'false'
	])
	await act(async () =>
		menuRadios()
			.find((node) => node.textContent === 'Full width')!
			.click()
	)
	expect(layoutControls.onColSpanChange).toHaveBeenCalledExactlyOnceWith(2)
	await act(async () =>
		menuRadios()
			.find((node) => node.textContent === 'Tall')!
			.click()
	)
	expect(layoutControls.onHeightChange).toHaveBeenCalledExactlyOnceWith('tall')
})
test('drops the height group for a card without heights and keeps the move group', async () => {
	await render(withLayoutCard(<ProCardOverflowMenu />, NO_HEIGHT_LAYOUT_CARD_CONTEXT))
	await openMenu()
	expect(document.body.querySelectorAll('[role="group"]')).toHaveLength(2)
	expect(menuRadios().map((node) => node.textContent)).toEqual([
		'Quarter width',
		'Half width',
		'Three-quarter width',
		'Full width'
	])
	expect(menuItems().map((node) => node.textContent)).toEqual(['Move up', 'Move down'])
})
test('drops every layout group in read-only', async () => {
	await render(withLayoutCard(<ProCardOverflowMenu />), readOnly)
	expect(container.querySelector('button')).toBeNull()
	await render(withLayoutCard(<ProCardOverflowMenu image={{ chartInstance: () => null }} />), readOnly)
	await openMenu()
	expect(menuRadios()).toHaveLength(0)
	expect(menuItems().map((node) => node.textContent)).toEqual(['Download image', 'Copy image'])
})
test('offers to bind or unbind the card to each parameter of a matching kind', async () => {
	const variables = {
		variables: [
			{ id: 'protocol', kind: 'protocol', label: 'Protocol', value: 'aave' },
			{ id: 'chain', kind: 'chain', label: 'Chain', value: 'Ethereum' }
		],
		canEditVariables: true,
		bindItemField
	} as DashboardTestState['variables']
	await render(withCard(<ProCardOverflowMenu image={{ chartInstance: () => null }} />), {
		items: [chartItem],
		variables
	})
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toEqual(['Download image', 'Copy image', 'Bind to Protocol'])
	await clickMenuItem('Bind to Protocol')
	expect(bindItemField).toHaveBeenCalledExactlyOnceWith('chart-1', 'subject', 'protocol')

	const boundItems = [{ ...chartItem, bindings: { subject: 'protocol' } }]
	await render(withCard(<ProCardOverflowMenu image={{ chartInstance: () => null }} />), {
		items: boundItems,
		variables
	})
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toContain('Unbind from Protocol')
	await clickMenuItem('Unbind from Protocol')
	expect(bindItemField).toHaveBeenLastCalledWith('chart-1', 'subject', null)

	await render(withCard(<ProCardOverflowMenu image={{ chartInstance: () => null }} />), {
		...readOnly,
		items: boundItems,
		variables
	})
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toEqual(['Download image', 'Copy image'])
})

test('ends the menu with Remove card when the card context carries onRemove', async () => {
	onRemoveCard.mockClear()
	await render(withLayoutCard(<ProCardOverflowMenu image={{ chartInstance: () => null }} />, REMOVABLE_CARD_CONTEXT))
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toEqual(['Download image', 'Copy image', 'Remove card'])
	await clickMenuItem('Remove card')
	expect(onRemoveCard).toHaveBeenCalledOnce()

	await render(withCard(<ProCardOverflowMenu image={{ chartInstance: () => null }} />))
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toEqual(['Download image', 'Copy image'])

	await render(withLayoutCard(<ProCardOverflowMenu />, REMOVABLE_CARD_CONTEXT), readOnly)
	expect(container.querySelector('button')).toBeNull()
})
