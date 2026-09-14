// @vitest-environment happy-dom
import { act, type ReactElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { StreamDoneContext, StreamItemReadinessContext } from '../queries'
import { ChartGrid } from './ChartGrid'

const mocks = vi.hoisted(() => ({
	items: [] as Array<DashboardItemConfig>,
	unavailableByItemId: new Map(),
	isReadOnly: false,
	handleChartsReordered: vi.fn(),
	handleRemoveItem: vi.fn(),
	handleColSpanChange: vi.fn(),
	handleHeightChange: vi.fn(),
	handleEditItem: vi.fn(),
	handleUpdateSection: vi.fn(),
	undo: vi.fn(),
	undoDepth: 0,
	deepLinkEnabled: false,
	toast: vi.fn(),
	dismissToast: vi.fn(),
	chartCardRenders: [] as Array<string>,
	realTextCard: false,
	router: {
		push: vi.fn(),
		replace: vi.fn(),
		pathname: '/pro/[dashboardId]/[[...mode]]',
		asPath: '/pro/dashboard',
		query: {} as Record<string, string | Array<string> | undefined>
	}
}))

const renderLayoutProbe = vi.hoisted(
	() =>
		(createElement: any, layout: any): any =>
			layout
				? createElement(
						'div',
						{ 'data-testid': 'card-layout' },
						layout.colSpanOptions.map((span: number) =>
							createElement(
								'button',
								{ key: `width-${span}`, type: 'button', onClick: () => layout.onColSpanChange(span) },
								`Width ${span}`
							)
						),
						layout.heightOptions.map((height: string) =>
							createElement(
								'button',
								{ key: `height-${height}`, type: 'button', onClick: () => layout.onHeightChange(height) },
								`Height ${height}`
							)
						),
						createElement(
							'button',
							{ type: 'button', disabled: !layout.canMoveUp, onClick: () => layout.onMove(-1) },
							'Move up'
						),
						createElement(
							'button',
							{ type: 'button', disabled: !layout.canMoveDown, onClick: () => layout.onMove(1) },
							'Move down'
						)
					)
				: null
)

const renderChromeProbe = vi.hoisted(
	() =>
		(createElement: any, DragHandle: any, context: any): any =>
			createElement(
				'div',
				{ 'data-testid': 'card-chrome' },
				createElement(DragHandle, { label: 'Drag to reorder this card' }),
				context?.onEdit ? createElement('button', { type: 'button', onClick: context.onEdit }, 'Edit card') : null,
				context?.onRemove
					? createElement('button', { type: 'button', onClick: context.onRemove }, 'Remove card')
					: null,
				renderLayoutProbe(createElement, context?.layout)
			)
)

const cardMock = vi.hoisted(() => (kind: string, exportName: string | null) => async () => {
	const { createElement } = await import('react')
	const { SortableDragHandle } = await import('~/containers/ProtocolOverview/ProtocolPro')
	const { useDashboardCardContext } = await import('./DashboardCardContext')
	function Card() {
		const context = useDashboardCardContext()
		return createElement(
			'div',
			{ 'data-testid': `card-${kind}` },
			renderChromeProbe(createElement, SortableDragHandle, context)
		)
	}
	return exportName === null ? { default: Card } : { [exportName]: Card }
})

vi.mock('next/router', () => ({ useRouter: () => mocks.router }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		isAuthenticated: true,
		hasActiveSubscription: true,
		isTrial: false,
		loaders: { userLoading: false }
	})
}))
vi.mock('~/components/ChartExport/useChartPngExport', () => ({
	useChartPngExport: () => ({ isExporting: false, downloadImage: vi.fn(), copyImage: vi.fn() })
}))
vi.mock('~/hooks/useMedia', () => ({ useMedia: () => true }))
vi.mock('react-hot-toast', () => ({ default: Object.assign(mocks.toast, { dismiss: mocks.dismissToast }) }))
vi.mock('../ProDashboardAPIContext', () => ({
	useProDashboardItemsState: () => ({ items: mocks.items }),
	useProDashboardVariables: () => ({
		variables: [],
		resolvedItems: mocks.items,
		unavailableByItemId: mocks.unavailableByItemId
	}),
	useProDashboardDashboard: () => ({ dashboardId: 'dashboard' }),
	useProDashboardEditorActions: () => ({
		handleChartsReordered: mocks.handleChartsReordered,
		handleRemoveItem: mocks.handleRemoveItem,
		handleColSpanChange: mocks.handleColSpanChange,
		handleHeightChange: mocks.handleHeightChange,
		handleEditItem: mocks.handleEditItem,
		handleUpdateSection: mocks.handleUpdateSection
	}),
	useProDashboardHistory: () => ({ undo: mocks.undo, undoDepth: mocks.undoDepth }),
	useProDashboardPermissions: () => ({ isReadOnly: mocks.isReadOnly })
}))
vi.mock('../queries', async () => {
	const { createContext } = await import('react')
	return {
		StreamDoneContext: createContext(true),
		StreamItemReadinessContext: createContext(null),
		ProxyAuthTokenContext: createContext(null)
	}
})
vi.mock('../hooks/useDashboardItemDeepLink', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../hooks/useDashboardItemDeepLink')>()
	return {
		...actual,
		useDashboardItemDeepLink: (options: Parameters<typeof actual.useDashboardItemDeepLink>[0]) =>
			actual.useDashboardItemDeepLink({ ...options, enabled: options.enabled && mocks.deepLinkEnabled })
	}
})
vi.mock('./InViewDashboardCard', async () => {
	const { createElement } = await import('react')
	return {
		InViewDashboardCard: ({ children, minHeight }: { children: ReactNode; minHeight: number }) =>
			createElement('div', { 'data-min-height': minHeight }, children)
	}
})
vi.mock('./ChartCard', async () => {
	const { createElement, useContext } = await import('react')
	const { SortableDragHandle } = await import('~/containers/ProtocolOverview/ProtocolPro')
	const { StreamDoneContext: Context } = await import('../queries')
	const { useDashboardCardContext } = await import('./DashboardCardContext')
	return {
		ChartCard: ({ chart }: { chart: DashboardItemConfig }) => {
			mocks.chartCardRenders.push(chart.id)
			const streamDone = useContext(Context)
			const context = useDashboardCardContext()
			return createElement(
				'div',
				{ 'data-testid': 'card-chart', 'data-stream-done': String(streamDone) },
				renderChromeProbe(createElement, SortableDragHandle, context)
			)
		}
	}
})
vi.mock('./TextCard', async (importOriginal) => {
	const { createElement } = await import('react')
	const { SortableDragHandle } = await import('~/containers/ProtocolOverview/ProtocolPro')
	const { useDashboardCardContext } = await import('./DashboardCardContext')
	const actual = await importOriginal<typeof import('./TextCard')>()
	return {
		TextCard: (props: { text: { content: string } }) => {
			const context = useDashboardCardContext()
			if (mocks.realTextCard) return createElement(actual.TextCard, props as never)
			return createElement(
				'div',
				{ 'data-testid': 'card-text' },
				props.text.content,
				renderChromeProbe(createElement, SortableDragHandle, context)
			)
		}
	}
})
vi.mock('./MultiChartCard', cardMock('multi', null))
vi.mock('./MetricCard', cardMock('metric', 'MetricCard'))
vi.mock('./ChartBuilderCard', cardMock('builder', 'ChartBuilderCard'))
vi.mock('./YieldsChartCard', cardMock('yields', 'YieldsChartCard'))
vi.mock('./StablecoinsChartCard', cardMock('stablecoins', 'StablecoinsChartCard'))
vi.mock('./StablecoinAssetChartCard', cardMock('stablecoin-asset', 'StablecoinAssetChartCard'))
vi.mock('./AdvancedTvlChartCard', cardMock('advanced-tvl', 'AdvancedTvlChartCard'))
vi.mock('./BorrowedChartCard', cardMock('advanced-borrowed', 'BorrowedChartCard'))
vi.mock('./IncomeStatementCard', cardMock('income-statement', 'IncomeStatementCard'))
vi.mock('./UnlocksScheduleCard', cardMock('unlocks-schedule', 'UnlocksScheduleCard'))
vi.mock('./UnlocksPieCard', cardMock('unlocks-pie', 'UnlocksPieCard'))
vi.mock('./LlamaAIChartCard', cardMock('llamaai-chart', null))
vi.mock('./RWAOverviewChartCard', cardMock('rwa-overview', 'RWAOverviewChartCard'))
vi.mock('./RWAAssetChartCard', cardMock('rwa-asset', 'RWAAssetChartCard'))
vi.mock('./SqlChart/SqlChartCard', cardMock('sql', 'SqlChartCard'))
vi.mock('./DatasetTableCard', cardMock('dataset-table', 'DatasetTableCard'))
vi.mock('./CustomData/CustomDataCard', cardMock('custom-data', 'CustomDataCard'))
vi.mock('./UnifiedTable', cardMock('unified-table', null))

const downloadChart = {
	chartType: 'bar' as const,
	xCol: 'label',
	yCols: ['value'],
	splitByCol: null,
	stackMode: 'off' as const,
	rightAxisCols: [],
	seriesKinds: {},
	seriesColors: {},
	numberFormat: 'auto' as const
}

const everyKind: Array<DashboardItemConfig> = [
	{ id: 'chart-1', kind: 'chart', type: 'tvl', subjectType: 'chain', chain: 'Ethereum' },
	{ id: 'multi-1', kind: 'multi', items: [] },
	{
		id: 'metric-1',
		kind: 'metric',
		subject: { itemType: 'chain', chain: 'Ethereum' },
		type: 'tvl',
		aggregator: 'latest',
		window: '30d',
		chartType: 'none'
	},
	{
		id: 'builder-1',
		kind: 'builder',
		config: {
			metric: 'fees',
			mode: 'chains',
			chainFilterMode: 'include',
			categoryFilterMode: 'include',
			chainCategoryFilterMode: 'include',
			protocolCategoryFilterMode: 'include',
			chains: [],
			categories: [],
			groupBy: 'protocol',
			limit: 10,
			chartType: 'line',
			displayAs: 'timeSeries'
		}
	},
	{ id: 'yields-1', kind: 'yields', poolConfigId: 'pool', poolName: 'Pool', project: 'aave', chain: 'Ethereum' },
	{ id: 'stablecoins-1', kind: 'stablecoins', chain: 'Ethereum', chartType: 'totalMcap' },
	{ id: 'stablecoin-asset-1', kind: 'stablecoin-asset', stablecoin: 'USDC', stablecoinId: '1', chartType: 'totalCirc' },
	{ id: 'advanced-tvl-1', kind: 'advanced-tvl', protocol: 'aave', protocolName: 'Aave', chartType: 'tvl' },
	{
		id: 'advanced-borrowed-1',
		kind: 'advanced-borrowed',
		protocol: 'aave',
		protocolName: 'Aave',
		chartType: 'chainsBorrowed'
	},
	{ id: 'income-statement-1', kind: 'income-statement', protocol: 'aave', protocolName: 'Aave' },
	{
		id: 'unlocks-schedule-1',
		kind: 'unlocks-schedule',
		protocol: 'aave',
		protocolName: 'Aave',
		dataType: 'documented'
	},
	{ id: 'unlocks-pie-1', kind: 'unlocks-pie', protocol: 'aave', protocolName: 'Aave', chartType: 'allocation' },
	{ id: 'llamaai-chart-1', kind: 'llamaai-chart' },
	{ id: 'rwa-overview-1', kind: 'rwa-overview', metric: 'activeMcap', chartView: 'timeSeries', breakdown: 'chain' },
	{ id: 'rwa-asset-1', kind: 'rwa-asset', assetId: 'asset', assetName: 'Asset', metrics: ['activeMcap'] },
	{ id: 'sql-1', kind: 'sql', query: { sql: 'select 1', tableSources: [] }, chart: downloadChart },
	{ id: 'dataset-table-1', kind: 'dataset-table', datasetType: 'stablecoins', chain: 'Ethereum' },
	{ id: 'unified-table-1', kind: 'unified-table', configVersion: 3, strategy: 'protocols', rowHeaders: ['protocol'] },
	{
		id: 'custom-data-1',
		kind: 'custom-data',
		name: 'Inline',
		columns: [{ name: 'label', type: 'string' }],
		chart: downloadChart,
		displayMode: 'table'
	},
	{ id: 'text-1', kind: 'text', content: 'Notes' },
	{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' }
]

const onAddChartClick = vi.fn()
const onEditItem = vi.fn()

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.clearAllMocks()
	localStorage.clear()
	mocks.items = []
	mocks.isReadOnly = false
	mocks.undoDepth = 0
	mocks.deepLinkEnabled = false
	mocks.chartCardRenders.length = 0
	mocks.realTextCard = false
	mocks.router.query = {}
	window.location.hash = ''
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function renderGrid(wrap?: (grid: ReactElement) => ReactElement) {
	const grid = <ChartGrid onAddChartClick={onAddChartClick} onEditItem={onEditItem} />
	await act(async () => root.render(wrap ? wrap(grid) : grid))
	await act(async () => {})
}

const COLLAPSE_SETTLE_MS = 320

async function settle(ms = 0) {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, ms))
	})
}

function buttons() {
	return Array.from(container.querySelectorAll('button'))
}

function buttonLabelled(label: string) {
	const button = buttons().find((node) => node.textContent?.trim() === label)
	expect(button).toBeDefined()
	return button!
}

test.each(everyKind.map((item) => [item.kind, item] as const))(
	'renders a %s item without crashing',
	async (kind, item) => {
		mocks.items = [item]
		await renderGrid()
		expect(container.querySelector(`[data-item-id="${item.id}"]`)).not.toBeNull()
		const renderedSelector = kind === 'section' ? '[data-testid="dashboard-section"]' : `[data-testid="card-${kind}"]`
		expect(container.querySelector(renderedSelector)).not.toBeNull()
	}
)

test('a read-only section renders its title as a heading above its cards', async () => {
	mocks.isReadOnly = true
	mocks.items = [
		{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' },
		{ id: 'text-1', kind: 'text', content: 'Notes' }
	]
	await renderGrid()
	expect(container.querySelector('h2')?.textContent).toBe('Overview')
	expect(container.querySelector('[data-testid="card-text"]')?.textContent).toBe('Notes')
})

test('a collapsed heading group keeps its cards mounted but hidden', async () => {
	mocks.items = [
		{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading', collapsed: true },
		{ id: 'chart-1', kind: 'chart', type: 'tvl', subjectType: 'chain', chain: 'Ethereum' }
	]
	await renderGrid()
	const group = container.querySelector<HTMLDivElement>('#section-content-section-1')!
	expect(group.hidden).toBe(true)
	expect(group.querySelector('[data-item-id="chart-1"]')).not.toBeNull()
})

test('collapsing a heading group animates before the group is hidden', async () => {
	mocks.items = [
		{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' },
		{ id: 'chart-1', kind: 'chart', type: 'tvl', subjectType: 'chain', chain: 'Ethereum' }
	]
	await renderGrid()
	const group = container.querySelector<HTMLDivElement>('#section-content-section-1')!
	expect(group.hidden).toBe(false)
	const collapse = buttons().find((node) => node.getAttribute('aria-label') === 'Collapse section')!
	await act(async () => collapse.click())
	await settle()
	expect(group.dataset.collapsed).toBe('true')
	expect(group.hidden).toBe(false)
	await settle(COLLAPSE_SETTLE_MS)
	expect(group.hidden).toBe(true)
	expect(group.querySelector('[data-item-id="chart-1"]')).not.toBeNull()
})

test('an idle grid renders no drag preview beside the cards', async () => {
	mocks.items = [{ id: 'text-1', kind: 'text', content: 'Notes' }]
	await renderGrid()
	expect(container.querySelectorAll('[data-item-id="text-1"]')).toHaveLength(1)
	expect(container.querySelectorAll('[data-testid="card-text"]')).toHaveLength(1)
	expect(container.querySelectorAll('#item-text-1')).toHaveLength(1)
	expect(container.querySelector('[data-skeleton]')).toBeNull()
})

test('a chart card hands its width and height presets to the card menu context', async () => {
	mocks.items = [{ id: 'chart-1', kind: 'chart', type: 'tvl', subjectType: 'chain', chain: 'Ethereum', height: 'tall' }]
	await renderGrid()
	const probe = container.querySelector('[data-testid="card-layout"]')!
	expect(Array.from(probe.querySelectorAll('button')).map((node) => node.textContent)).toEqual([
		'Width 0.5',
		'Width 1',
		'Width 1.5',
		'Width 2',
		'Height compact',
		'Height default',
		'Height tall',
		'Move up',
		'Move down'
	])
	await act(async () => buttonLabelled('Height default').click())
	expect(mocks.handleHeightChange).toHaveBeenCalledWith('chart-1', 'default')
	await act(async () => buttonLabelled('Width 1.5').click())
	expect(mocks.handleColSpanChange).toHaveBeenCalledWith('chart-1', 1.5)
})

test('a text card offers widths but no heights, and a metric card only the narrow widths', async () => {
	mocks.items = [
		{ id: 'text-1', kind: 'text', content: 'Notes' },
		{
			id: 'metric-1',
			kind: 'metric',
			subject: { itemType: 'chain', chain: 'Ethereum' },
			type: 'tvl',
			aggregator: 'latest',
			window: '30d',
			chartType: 'none'
		}
	]
	await renderGrid()
	const layoutButtons = (itemId: string) =>
		Array.from(container.querySelectorAll(`[data-item-id="${itemId}"] [data-testid="card-layout"] button`)).map(
			(node) => node.textContent
		)
	expect(layoutButtons('text-1')).toEqual(['Width 0.5', 'Width 1', 'Width 1.5', 'Width 2', 'Move up', 'Move down'])
	expect(layoutButtons('metric-1')).toEqual(['Width 0.5', 'Width 1', 'Move up', 'Move down'])
})

test('a section row carries no layout controls and no drag handle', async () => {
	mocks.items = [
		{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' },
		{ id: 'text-1', kind: 'text', content: 'Notes' }
	]
	await renderGrid()
	const section = container.querySelector<HTMLDivElement>('[data-item-id="section-1"]')!
	expect(section.querySelector('[data-testid="card-layout"]')).toBeNull()
	expect(section.querySelector('[aria-label="Drag to reorder this card"]')).toBeNull()
	expect(section.getAttribute('aria-roledescription')).toBeNull()
	expect(container.querySelector('[data-item-id="text-1"] [aria-label="Drag to reorder this card"]')).not.toBeNull()
})

test('the drag handle carries the sortable attributes instead of the card root', async () => {
	mocks.items = [{ id: 'text-1', kind: 'text', content: 'Notes' }]
	await renderGrid()
	const card = container.querySelector<HTMLDivElement>('[data-item-id="text-1"]')!
	const handle = card.querySelector<HTMLButtonElement>('[aria-label="Drag to reorder this card"]')!
	expect(handle.getAttribute('aria-roledescription')).toBe('sortable')
	expect(card.getAttribute('aria-roledescription')).toBeNull()
	expect(card.getAttribute('role')).toBeNull()

	mocks.isReadOnly = true
	await renderGrid()
	const readOnlyCard = container.querySelector<HTMLDivElement>('[data-item-id="text-1"]')!
	expect(readOnlyCard.querySelector('[aria-label="Drag to reorder this card"]')).toBeNull()
	expect(readOnlyCard.getAttribute('aria-roledescription')).toBeNull()
})

test.each([
	['Move up', ['middle', 'first', 'last']],
	['Move down', ['first', 'last', 'middle']]
] as const)('%s from the card menu context reorders within the group', async (label, expected) => {
	mocks.items = ['first', 'middle', 'last'].map((id) => ({ id, kind: 'text' as const, content: id }))
	await renderGrid()
	const moveButtons = buttons().filter((node) => node.textContent?.trim() === label)
	expect(moveButtons[label === 'Move up' ? 0 : 2].disabled).toBe(true)
	const button = moveButtons[1]
	expect(button.disabled).toBe(false)
	await act(async () => button.click())
	expect(mocks.handleChartsReordered).toHaveBeenCalledOnce()
	expect(mocks.handleChartsReordered.mock.calls[0][0].map((item: { id: string }) => item.id)).toEqual(expected)
})

test('a fresh readiness set with unchanged readiness does not re-render a card', async () => {
	mocks.isReadOnly = true
	mocks.items = [{ id: 'chart-1', kind: 'chart', type: 'tvl', subjectType: 'chain', chain: 'Ethereum' }]
	const renderWithReadiness = (readyItemIds: ReadonlySet<string>) =>
		renderGrid((grid) => (
			<StreamDoneContext.Provider value={false}>
				<StreamItemReadinessContext.Provider value={readyItemIds}>{grid}</StreamItemReadinessContext.Provider>
			</StreamDoneContext.Provider>
		))
	const streamDoneAttribute = () =>
		container.querySelector('[data-testid="card-chart"]')?.getAttribute('data-stream-done')

	await renderWithReadiness(new Set())
	expect(streamDoneAttribute()).toBe('false')
	const rendersBefore = mocks.chartCardRenders.length

	await renderWithReadiness(new Set(['other-item']))
	expect(mocks.chartCardRenders.length).toBe(rendersBefore)
	expect(streamDoneAttribute()).toBe('false')

	await renderWithReadiness(new Set(['chart-1']))
	expect(mocks.chartCardRenders.length).toBeGreaterThan(rendersBefore)
	expect(streamDoneAttribute()).toBe('true')
})

test('removing a card skips confirmation and offers Undo in a toast', async () => {
	mocks.realTextCard = true
	mocks.items = [{ id: 'text-1', kind: 'text', content: 'Notes' }]
	await renderGrid()
	await act(async () => (container.querySelector('[aria-label="More actions"]') as HTMLButtonElement).click())
	const removeCard = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
		(node) => node.textContent === 'Remove card'
	)!
	expect(removeCard.getAttribute('data-umami-event')).toBe('dashboard-card-remove')
	await act(async () => removeCard.click())
	expect(mocks.handleRemoveItem).toHaveBeenCalledWith('text-1')
	expect(container.querySelector('[role="dialog"]')).toBeNull()
	expect(mocks.toast).toHaveBeenCalledOnce()
	const [renderToast, options] = mocks.toast.mock.calls[0]
	expect(options.ariaProps.role).toBe('status')
	const toastContainer = document.createElement('div')
	document.body.appendChild(toastContainer)
	const toastRoot = createRoot(toastContainer)
	await act(async () => toastRoot.render(renderToast({ id: 'toast-1' })))
	const undoButton = Array.from(toastContainer.querySelectorAll('button')).find(
		(node) => node.textContent?.trim() === 'Undo'
	)!
	expect(undoButton.getAttribute('data-umami-event')).toBe('dashboard-undo')
	await act(async () => undoButton.click())
	expect(mocks.undo).toHaveBeenCalledOnce()
	expect(mocks.dismissToast).toHaveBeenCalledWith('toast-1')
	await act(async () => toastRoot.unmount())
	toastContainer.remove()
})

test('an edit made while the card removal toast is alive dismisses it', async () => {
	mocks.items = [{ id: 'text-1', kind: 'text', content: 'Notes' }]
	await renderGrid()
	await act(async () => buttonLabelled('Remove card').click())
	expect(mocks.toast.mock.calls[0][1].id).toBe('card-removed')

	mocks.undoDepth = 1
	await renderGrid()
	expect(mocks.dismissToast).not.toHaveBeenCalled()

	mocks.undoDepth = 2
	await renderGrid()
	expect(mocks.dismissToast).toHaveBeenCalledWith('card-removed')
	expect(mocks.dismissToast).toHaveBeenCalledWith('section-removed')
})

test('an undo made while the card removal toast is alive dismisses it', async () => {
	mocks.undoDepth = 3
	mocks.items = [{ id: 'text-1', kind: 'text', content: 'Notes' }]
	await renderGrid()
	await act(async () => buttonLabelled('Remove card').click())

	mocks.undoDepth = 4
	await renderGrid()
	expect(mocks.dismissToast).not.toHaveBeenCalled()

	mocks.undoDepth = 3
	await renderGrid()
	expect(mocks.dismissToast).toHaveBeenCalledWith('card-removed')
})

test('a card permalink expands the collapsed heading holding the card', async () => {
	const scrollIntoView = vi.fn()
	HTMLElement.prototype.scrollIntoView = scrollIntoView
	mocks.deepLinkEnabled = true
	mocks.items = [
		{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading', collapsed: true },
		{ id: 'text-1', kind: 'text', content: 'Notes' }
	]
	window.location.hash = '#item=text-1'
	await renderGrid()
	await act(async () => {
		await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
	})
	expect(localStorage.getItem('pro-dashboard-collapsed:dashboard')).toBe('{"section-1":false}')
	const card = container.querySelector('#item-text-1')!
	expect(card.closest('[hidden]')).toBeNull()
	expect(card.classList.contains('ring-2')).toBe(true)
})

test('a text card rendering raw HTML gets no edit affordance', async () => {
	mocks.items = [
		{ id: 'text-1', kind: 'text', content: 'Notes' },
		{ id: 'text-2', kind: 'text', content: '<b>Raw</b>', allowHtml: true }
	]
	await renderGrid()
	const editButtons = (itemId: string) =>
		Array.from(container.querySelectorAll(`[data-item-id="${itemId}"] button`)).filter(
			(node) => node.textContent?.trim() === 'Edit card'
		)
	expect(editButtons('text-1')).toHaveLength(1)
	expect(editButtons('text-2')).toHaveLength(0)
	expect(container.querySelector('[data-item-id="text-2"] [aria-label="Drag to reorder this card"]')).not.toBeNull()
})

test('the active tab keeps its editable section card inside the panel', async () => {
	mocks.items = [
		{ id: 'tab-a', kind: 'section', title: 'First', displayAs: 'tab' },
		{ id: 'text-a', kind: 'text', content: 'In first' },
		{ id: 'tab-b', kind: 'section', title: 'Second', displayAs: 'tab' },
		{ id: 'text-b', kind: 'text', content: 'In second' }
	]
	await act(async () =>
		root.render(<ChartGrid onAddChartClick={onAddChartClick} onEditItem={onEditItem} tabQueryParam="tab" />)
	)
	await act(async () => {})
	const sectionCards = container.querySelectorAll('[data-testid="dashboard-section"]')
	expect(sectionCards).toHaveLength(1)
	expect(sectionCards[0]?.textContent).toContain('First')
	expect(
		buttons().find(
			(node) => node.getAttribute('aria-label') === 'Delete section' || node.textContent?.includes('Delete section')
		)
	).toBeDefined()
})

test('a tab section carries the deep-link wrapper without a drag handle of its own', async () => {
	mocks.items = [
		{ id: 'tab-a', kind: 'section', title: 'First', displayAs: 'tab' },
		{ id: 'text-a', kind: 'text', content: 'In first' }
	]
	await act(async () =>
		root.render(<ChartGrid onAddChartClick={onAddChartClick} onEditItem={onEditItem} tabQueryParam="tab" />)
	)
	await act(async () => {})
	const wrapper = container.querySelector<HTMLDivElement>('#item-tab-a')!
	expect(wrapper.className).toContain('group/dashboard-section')
	expect(wrapper.querySelector('[data-testid="dashboard-section"]')).not.toBeNull()
	expect(wrapper.querySelector('[aria-label="Drag to reorder this card"]')).toBeNull()
	expect(
		container.querySelector<HTMLDivElement>('[data-item-id="tab-a"]')!.getAttribute('aria-roledescription')
	).toBeNull()
})

test('switching tabs writes the active tab to the query string and drops it for the first tab', async () => {
	mocks.items = [
		{ id: 'tab-a', kind: 'section', title: 'First', displayAs: 'tab' },
		{ id: 'text-a', kind: 'text', content: 'In first' },
		{ id: 'tab-b', kind: 'section', title: 'Second', displayAs: 'tab' },
		{ id: 'text-b', kind: 'text', content: 'In second' }
	]
	const renderTabbedGrid = async () => {
		await act(async () =>
			root.render(<ChartGrid onAddChartClick={onAddChartClick} onEditItem={onEditItem} tabQueryParam="tab" />)
		)
		await act(async () => {})
	}
	await renderTabbedGrid()
	expect(container.textContent).toContain('In first')
	expect(container.textContent).not.toContain('In second')

	await act(async () => buttonLabelled('Second').click())
	expect(mocks.router.replace).toHaveBeenCalledWith(
		{ pathname: '/pro/[dashboardId]/[[...mode]]', query: { tab: 'tab-b' } },
		undefined,
		{ shallow: true, scroll: false }
	)

	mocks.router.query = { tab: 'tab-b' }
	await renderTabbedGrid()
	expect(container.textContent).toContain('In second')
	expect(container.textContent).not.toContain('In first')

	await act(async () => buttonLabelled('First').click())
	expect(mocks.router.replace).toHaveBeenLastCalledWith(
		{ pathname: '/pro/[dashboardId]/[[...mode]]', query: {} },
		undefined,
		{
			shallow: true,
			scroll: false
		}
	)
})

test('switching read-only off keeps card elements mounted', async () => {
	mocks.isReadOnly = true
	mocks.items = [
		{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' },
		{ id: 'chart-1', kind: 'chart', type: 'tvl', subjectType: 'chain', chain: 'Ethereum' }
	]
	await renderGrid()
	const card = container.querySelector('[data-item-id="chart-1"]')!
	const cardBody = container.querySelector('[data-testid="card-chart"]')!
	const section = container.querySelector('[data-item-id="section-1"]')!
	expect(card.querySelector('button')).toBeNull()

	mocks.isReadOnly = false
	await renderGrid()

	expect(container.querySelector('[data-item-id="chart-1"]')).toBe(card)
	expect(container.querySelector('[data-testid="card-chart"]')).toBe(cardBody)
	expect(container.querySelector('[data-item-id="section-1"]')).toBe(section)
	expect(buttonLabelled('Remove card')).toBeDefined()
})

test('removing a section keeps its cards and offers Undo in its own toast', async () => {
	mocks.items = [
		{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' },
		{ id: 'text-1', kind: 'text', content: 'Notes' }
	]
	await renderGrid()
	const remove = buttons().find((node) => node.getAttribute('aria-label') === 'Delete section')!
	await act(async () => remove.click())
	expect(mocks.handleChartsReordered.mock.calls[0][0].map((item: { id: string }) => item.id)).toEqual(['text-1'])
	const [renderToast, options] = mocks.toast.mock.calls[0]
	expect(options.id).toBe('section-removed')
	const toastContainer = document.createElement('div')
	document.body.appendChild(toastContainer)
	const toastRoot = createRoot(toastContainer)
	await act(async () => toastRoot.render(renderToast({ id: 'toast-1' })))
	expect(toastContainer.textContent).toContain('Section removed · cards stay')
	await act(async () => Array.from(toastContainer.querySelectorAll('button')).at(-1)!.click())
	expect(mocks.undo).toHaveBeenCalledOnce()
	await act(async () => toastRoot.unmount())
	toastContainer.remove()
})

test('the Heading/Tab segment switches how a section renders', async () => {
	mocks.items = [
		{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' },
		{ id: 'text-1', kind: 'text', content: 'Notes' }
	]
	await renderGrid()
	const segment = container.querySelector<HTMLElement>('[aria-label="Section display"]')!
	const option = (label: string) =>
		Array.from(segment.querySelectorAll<HTMLLabelElement>('label')).find((node) => node.textContent === label)!
	expect(option('Heading').getAttribute('data-active')).toBe('true')
	expect(option('Tab').getAttribute('data-active')).toBe('false')
	await act(async () => option('Tab').querySelector<HTMLInputElement>('input')!.click())
	expect(mocks.handleUpdateSection).toHaveBeenCalledWith('section-1', { displayAs: 'tab' })

	await act(async () => option('Heading').querySelector<HTMLInputElement>('input')!.click())
	expect(mocks.handleUpdateSection).toHaveBeenCalledOnce()
})

test('the shared area above tabs is labelled and keeps its own add tile', async () => {
	mocks.items = [
		{ id: 'text-shared', kind: 'text', content: 'Shared' },
		{ id: 'tab-a', kind: 'section', title: 'First', displayAs: 'tab' },
		{ id: 'text-a', kind: 'text', content: 'In first' }
	]
	await renderGrid()
	expect(container.textContent).toContain('Shown on every tab')
	const addTiles = buttons().filter((node) => node.textContent?.trim() === 'Add card')
	expect(addTiles).toHaveLength(2)
	await act(async () => addTiles[0].click())
	expect(onAddChartClick).toHaveBeenCalledWith({ beforeItemId: 'tab-a' })
	await act(async () => addTiles[1].click())
	expect(onAddChartClick).toHaveBeenLastCalledWith(undefined)

	mocks.isReadOnly = true
	await renderGrid()
	expect(container.textContent).not.toContain('Shown on every tab')
})

test('tabs without shared cards still offer the shared area to an editor', async () => {
	mocks.items = [
		{ id: 'tab-a', kind: 'section', title: 'First', displayAs: 'tab' },
		{ id: 'text-a', kind: 'text', content: 'In first' }
	]
	await renderGrid()
	expect(container.textContent).toContain('Shown on every tab')
	await act(async () => buttonLabelled('Add card').click())
	expect(onAddChartClick).toHaveBeenCalledWith({ beforeItemId: 'tab-a' })

	mocks.isReadOnly = true
	await renderGrid()
	expect(container.textContent).not.toContain('Shown on every tab')
	expect(buttons().some((node) => node.textContent?.trim() === 'Add card')).toBe(false)
})

test('a card keeps its deep-link id on the bordered root in both modes', async () => {
	mocks.items = [{ id: 'text-1', kind: 'text', content: 'Notes' }]
	await renderGrid()
	const card = container.querySelector<HTMLDivElement>('[data-item-id="text-1"]')!
	expect(card.id).toBe('item-text-1')
	expect(card.className).toContain('border-pro-cards-border')

	mocks.isReadOnly = true
	await renderGrid()
	const readOnlyCard = container.querySelector<HTMLDivElement>('[data-item-id="text-1"]')!
	expect(readOnlyCard.id).toBe('item-text-1')
	expect(readOnlyCard.className).toContain('border-pro-cards-border')
})

test('a dataset table spans the full grid in both modes', async () => {
	mocks.items = [{ id: 'dataset-table-1', kind: 'dataset-table', datasetType: 'stablecoins', chain: 'Ethereum' }]
	await renderGrid()
	expect(container.querySelector<HTMLDivElement>('[data-item-id="dataset-table-1"]')!.style.gridColumn).toBe('1/-1')

	mocks.isReadOnly = true
	await renderGrid()
	expect(container.querySelector<HTMLDivElement>('[data-item-id="dataset-table-1"]')!.style.gridColumn).toBe('1/-1')
})

test('an empty tab says so, and only offers the add tile to an editor', async () => {
	mocks.items = [
		{ id: 'tab-a', kind: 'section', title: 'First', displayAs: 'tab' },
		{ id: 'tab-b', kind: 'section', title: 'Second', displayAs: 'tab' },
		{ id: 'text-b', kind: 'text', content: 'In second' }
	]
	await renderGrid()
	expect(container.textContent).toContain('This tab has no cards yet. Add one or drag a card here.')
	expect(container.querySelector('[data-testid="dashboard-grid"] [role="status"]')).toBeNull()

	mocks.isReadOnly = true
	await renderGrid()
	expect(container.querySelector('[data-testid="dashboard-grid"] [role="status"]')?.textContent).toBe(
		'Nothing in this tab yet'
	)
	expect(buttons().some((node) => node.textContent?.trim() === 'Add card')).toBe(false)
})
