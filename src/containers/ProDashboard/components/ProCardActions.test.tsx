// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { getEmbedCardHeight } from '../dashboardLayout/cardHeight'
import { DashboardCardContext, type DashboardCardContextValue } from './DashboardCardContext'
import { ProCardEditControls, ProCardOverflowMenu } from './ProCardActions'
const mocks = vi.hoisted(() => ({
	permissions: { isReadOnly: false, hideDuplicateButton: false },
	dashboard: { currentDashboard: null as { id: string; slug?: string; visibility: 'public' | 'private' } | null },
	items: { current: [] as Array<DashboardItemConfig> },
	auth: { isAuthenticated: true, hasActiveSubscription: true, isTrial: false, loaders: { userLoading: false } },
	download: vi.fn(),
	writeText: vi.fn(),
	variables: {
		variables: [] as Array<{ id: string; kind: 'chain' | 'protocol'; label: string; value: string }>,
		canEditVariables: true,
		bindItemField: vi.fn()
	}
}))
vi.mock('../ProDashboardAPIContext', () => ({
	useProDashboardPermissions: () => mocks.permissions,
	useProDashboardDashboard: () => mocks.dashboard,
	useProDashboardItemsState: () => ({ items: mocks.items.current }),
	useProDashboardVariables: () => mocks.variables
}))
vi.mock('~/auth', () => ({ useAuthContext: () => mocks.auth }))
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test' }) }))
vi.mock('~/utils/download', () => ({ downloadCSV: mocks.download }))
vi.mock('~/components/ChartExport/useChartPngExport', () => ({
	useChartPngExport: () => ({ isExporting: false, downloadImage: vi.fn(), copyImage: vi.fn() })
}))
vi.mock('~/containers/Subscription/shared/SubscribeCards/SubscribeProCard', () => ({
	SubscribeProModal: () => <div>Subscribe to export</div>
}))
const publicDashboard = { id: 'dashboard-1', slug: 'fees-dash', visibility: 'public' as const }
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
	mocks.permissions.isReadOnly = false
	mocks.permissions.hideDuplicateButton = false
	mocks.auth.hasActiveSubscription = true
	mocks.dashboard.currentDashboard = null
	mocks.items.current = []
	mocks.variables.variables = []
	mocks.variables.bindItemField.mockClear()
	mocks.download.mockClear()
	mocks.writeText.mockClear()
	layoutControls.onColSpanChange.mockClear()
	layoutControls.onHeightChange.mockClear()
	layoutControls.onMove.mockClear()
	mocks.writeText.mockResolvedValue(undefined)
	Object.defineProperty(navigator, 'clipboard', { value: { writeText: mocks.writeText }, configurable: true })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
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
	mocks.permissions.isReadOnly = true
	await act(async () =>
		root.render(
			<>
				<ProCardEditControls>
					<button type="button">Edit</button>
				</ProCardEditControls>
				<ProCardOverflowMenu image={{ chartInstance: () => null }} onDuplicate={vi.fn()} />
			</>
		)
	)
	expect(container.textContent).not.toContain('Edit')
	await openMenu()
	expect(document.body.textContent).toContain('Download image')
	expect(document.body.textContent).not.toContain('Duplicate')
})
test('has no trigger without actions and respects hidden duplicate', async () => {
	await act(async () => root.render(<ProCardOverflowMenu />))
	expect(container.querySelector('button')).toBeNull()
	mocks.permissions.hideDuplicateButton = true
	await act(async () => root.render(<ProCardOverflowMenu onDuplicate={vi.fn()} />))
	expect(container.querySelector('button')).toBeNull()
})
test('CSV downloads for subscribers and opens the gate otherwise', async () => {
	const prepareCsv = () => ({ filename: 'Example', rows: [['value'], [1]] })
	await act(async () => root.render(<ProCardOverflowMenu csv={{ prepareCsv }} />))
	await openMenu()
	await clickMenuItem('Download CSV')
	expect(mocks.download).toHaveBeenCalledOnce()
	mocks.auth.hasActiveSubscription = false
	await act(async () => root.render(<ProCardOverflowMenu csv={{ prepareCsv }} />))
	await openMenu()
	await clickMenuItem('Download CSV')
	expect(mocks.download).toHaveBeenCalledOnce()
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 20))
	})
	expect(document.body.textContent).toContain('Subscribe to export')
})
test('offers a card permalink and an embed snippet for cards on a public dashboard', async () => {
	mocks.permissions.isReadOnly = true
	mocks.dashboard.currentDashboard = publicDashboard
	mocks.items.current = [chartItem]
	await act(async () => root.render(withCard(<ProCardOverflowMenu image={{ chartInstance: () => null }} />)))
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toEqual([
		'Download image',
		'Copy image',
		'Copy link to card',
		'Embed card…'
	])
	expect(document.body.querySelector('[data-umami-event="copy-card-link"]')).not.toBeNull()
	expect(document.body.querySelector('[data-umami-event="embed-card"]')).not.toBeNull()
	await clickMenuItem('Copy link to card')
	expect(mocks.writeText).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}/pro/fees-dash#item=chart-1`)
	await openMenu()
	await clickMenuItem('Embed card…')
	const textarea = document.body.querySelector<HTMLTextAreaElement>('textarea[aria-label="Embed code"]')
	expect(textarea?.value).toBe(
		'<iframe src="https://defillama.com/pro/embed/fees-dash?item=chart-1&theme=dark" width="100%" height="558" style="border:0" loading="lazy"></iframe>'
	)
	await act(async () =>
		Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
			.find((node) => node.textContent === 'Light')!
			.click()
	)
	expect(textarea?.value).toContain('theme=light')
	await act(async () =>
		Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
			.find((node) => node.textContent?.trim() === 'Copy code')!
			.click()
	)
	expect(mocks.writeText).toHaveBeenLastCalledWith(expect.stringContaining('theme=light'))
})
test('shows the trigger for a shareable card even without exports, before duplicate', async () => {
	mocks.dashboard.currentDashboard = publicDashboard
	mocks.items.current = [chartItem]
	await act(async () => root.render(withCard(<ProCardOverflowMenu onDuplicate={vi.fn()} />)))
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toEqual(['Copy link to card', 'Embed card…', 'Duplicate'])
	expect(document.body.querySelectorAll('[role="separator"]')).toHaveLength(1)
})
test('hides card sharing without a card context or on a private dashboard', async () => {
	mocks.dashboard.currentDashboard = publicDashboard
	mocks.items.current = [chartItem]
	await act(async () => root.render(<ProCardOverflowMenu image={{ chartInstance: () => null }} />))
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toEqual(['Download image', 'Copy image'])
	await act(async () => root.render(<ProCardOverflowMenu />))
	expect(container.querySelector('button')).toBeNull()
	mocks.dashboard.currentDashboard = { ...publicDashboard, visibility: 'private' }
	await act(async () => root.render(withCard(<ProCardOverflowMenu image={{ chartInstance: () => null }} />)))
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toEqual(['Download image', 'Copy image'])
	await act(async () => root.render(withCard(<ProCardOverflowMenu />)))
	expect(container.querySelector('button')).toBeNull()
})
test('renders width, height and move groups from the card layout context', async () => {
	await act(async () => root.render(withLayoutCard(<ProCardOverflowMenu />)))
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
	expect(document.body.querySelectorAll('[data-umami-event="dashboard-card-width"]').length).toBe(4)
	expect(document.body.querySelectorAll('[data-umami-event="dashboard-card-height"]').length).toBe(3)
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
	const moveUp = menuItems().find((node) => node.textContent === 'Move up')!
	expect(moveUp.getAttribute('aria-disabled')).toBe('true')
	await clickMenuItem('Move down')
	expect(layoutControls.onMove).toHaveBeenCalledExactlyOnceWith(1)
})
test('drops the height group for a card without heights and keeps the move group', async () => {
	await act(async () => root.render(withLayoutCard(<ProCardOverflowMenu />, NO_HEIGHT_LAYOUT_CARD_CONTEXT)))
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
	mocks.permissions.isReadOnly = true
	await act(async () => root.render(withLayoutCard(<ProCardOverflowMenu />)))
	expect(container.querySelector('button')).toBeNull()
	await act(async () => root.render(withLayoutCard(<ProCardOverflowMenu image={{ chartInstance: () => null }} />)))
	await openMenu()
	expect(menuRadios()).toHaveLength(0)
	expect(menuItems().map((node) => node.textContent)).toEqual(['Download image', 'Copy image'])
})
test('offers to bind or unbind the card to each parameter of a matching kind', async () => {
	mocks.items.current = [chartItem]
	mocks.variables.variables = [
		{ id: 'protocol', kind: 'protocol', label: 'Protocol', value: 'aave' },
		{ id: 'chain', kind: 'chain', label: 'Chain', value: 'Ethereum' }
	]
	await act(async () => root.render(withCard(<ProCardOverflowMenu image={{ chartInstance: () => null }} />)))
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toEqual(['Download image', 'Copy image', 'Bind to Protocol'])
	expect(document.body.querySelector('[data-umami-event="dashboard-card-bind"]')).not.toBeNull()
	await clickMenuItem('Bind to Protocol')
	expect(mocks.variables.bindItemField).toHaveBeenCalledExactlyOnceWith('chart-1', 'subject', 'protocol')

	mocks.items.current = [{ ...chartItem, bindings: { subject: 'protocol' } }]
	await act(async () => root.render(withCard(<ProCardOverflowMenu image={{ chartInstance: () => null }} />)))
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toContain('Unbind from Protocol')
	await clickMenuItem('Unbind from Protocol')
	expect(mocks.variables.bindItemField).toHaveBeenLastCalledWith('chart-1', 'subject', null)

	mocks.permissions.isReadOnly = true
	await act(async () => root.render(withCard(<ProCardOverflowMenu image={{ chartInstance: () => null }} />)))
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toEqual(['Download image', 'Copy image'])
})

test('ends the menu with Remove card when the card context carries onRemove', async () => {
	onRemoveCard.mockClear()
	await act(async () =>
		root.render(
			<DashboardCardContext.Provider value={REMOVABLE_CARD_CONTEXT}>
				<ProCardOverflowMenu image={{ chartInstance: () => null }} />
			</DashboardCardContext.Provider>
		)
	)
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toEqual(['Download image', 'Copy image', 'Remove card'])
	expect(document.body.querySelector('[data-umami-event="dashboard-card-remove"]')).not.toBeNull()
	await clickMenuItem('Remove card')
	expect(onRemoveCard).toHaveBeenCalledOnce()

	await act(async () => root.render(withCard(<ProCardOverflowMenu image={{ chartInstance: () => null }} />)))
	await openMenu()
	expect(menuItems().map((node) => node.textContent)).toEqual(['Download image', 'Copy image'])

	mocks.permissions.isReadOnly = true
	await act(async () =>
		root.render(
			<DashboardCardContext.Provider value={REMOVABLE_CARD_CONTEXT}>
				<ProCardOverflowMenu />
			</DashboardCardContext.Provider>
		)
	)
	expect(container.querySelector('button')).toBeNull()
})
test('embed height follows the card kind and height scale plus the header', () => {
	expect(getEmbedCardHeight(chartItem)).toBe(558)
	expect(getEmbedCardHeight({ ...chartItem, height: 'compact' })).toBe(324)
	expect(
		getEmbedCardHeight({
			id: 'metric-1',
			kind: 'metric',
			subject: { itemType: 'protocol', protocol: 'aave' },
			type: 'tvl',
			aggregator: 'latest',
			window: '30d',
			chartType: 'sparkline'
		})
	).toBe(194)
	expect(getEmbedCardHeight(undefined)).toBe(414)
})
