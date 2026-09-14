// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { Chain, ChartConfig, Protocol } from '../types'
import type { DashboardItemPlacement } from '../useDashboardActions'
import { QuickAddPalette } from './QuickAddPalette'

const mocks = vi.hoisted(() => ({
	appendItems: vi.fn((_createItems: (existing: Array<DashboardItemConfig>) => Array<DashboardItemConfig>) => [
		'added-item'
	]) as unknown as ReturnType<typeof vi.fn>,
	items: [] as Array<DashboardItemConfig>,
	protocolsLoading: false,
	metadataLoading: false,
	metadataError: undefined as string | undefined,
	reveal: vi.fn(),
	pushRecent: vi.fn(() => []),
	readRecents: vi.fn(() => [])
}))

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toastMock, toast: toastMock }))

const protocols: Array<Protocol> = [
	{ id: 'uniswap', name: 'Uniswap', slug: 'uniswap', tvl: 5_000_000_000, chains: [], symbol: 'UNI' },
	{ id: 'aave', name: 'Aave', slug: 'aave', tvl: 20_000_000_000, chains: [], symbol: 'AAVE' }
]

const chains: Array<Chain> = [
	{ name: 'Ethereum', gecko_id: 'ethereum', tvl: 60_000_000_000, tokenSymbol: 'ETH', chainId: null, cmcId: null }
]

const AVAILABLE_PROTOCOL_TYPES: Record<string, Array<string>> = {
	uniswap: ['tvl', 'fees', 'revenue', 'volume'],
	aave: ['tvl', 'fees', 'revenue']
}

vi.mock('../ProDashboardAPIContext', () => ({
	useProDashboardCatalog: () => ({
		protocols,
		chains,
		protocolsLoading: mocks.protocolsLoading,
		parentMapping: new Map<string, Array<string>>()
	}),
	useProDashboardEditorActions: () => ({ handleAppendItems: mocks.appendItems }),
	useProDashboardItemsState: () => ({ items: mocks.items })
}))

vi.mock('../AppMetadataContext', () => ({
	useAppMetadata: () => ({
		loading: mocks.metadataLoading,
		error: mocks.metadataError,
		availableProtocolChartTypes: (slug: string) => AVAILABLE_PROTOCOL_TYPES[slug] ?? [],
		availableChainChartTypes: () => ['tvl', 'fees']
	})
}))

vi.mock('../hooks/useDashboardItemDeepLink', () => ({ requestDashboardItemReveal: mocks.reveal }))

vi.mock('../quickAdd/quickAddRecents', () => ({
	readQuickAddRecents: mocks.readRecents,
	pushQuickAddRecent: mocks.pushRecent
}))

let root: Root
let container: HTMLDivElement
const onClose = vi.fn()
const onClosed = vi.fn()
const onOpenFullEditor = vi.fn()

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.clearAllMocks()
	mocks.appendItems.mockImplementation(() => ['added-item'])
	mocks.readRecents.mockImplementation(() => [])
	mocks.items = []
	mocks.protocolsLoading = false
	mocks.metadataLoading = false
	mocks.metadataError = undefined
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function renderPalette(placement?: DashboardItemPlacement) {
	await act(async () =>
		root.render(
			<QuickAddPalette
				open
				onClose={onClose}
				onClosed={onClosed}
				onOpenFullEditor={onOpenFullEditor}
				{...(placement === undefined ? {} : { placement })}
			/>
		)
	)
}

function input() {
	const field = document.body.querySelector<HTMLInputElement>('input[aria-label="Quick add"]')
	if (!field) throw new Error('missing quick add input')
	return field
}

function rows() {
	return Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]'))
}

function statusText() {
	return Array.from(document.body.querySelectorAll('[role="status"]'))
		.map((node) => node.textContent?.trim())
		.filter(Boolean)
		.join('|')
}

async function type(text: string) {
	const field = input()
	field.focus()
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, text)
		field.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

async function pressKey(key: string, init: KeyboardEventInit = {}) {
	await act(async () => {
		input().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
	})
}

function appendedItems(callIndex = 0): Array<DashboardItemConfig> {
	const createItems = mocks.appendItems.mock.calls[callIndex]?.[0] as (
		existing: Array<DashboardItemConfig>
	) => Array<DashboardItemConfig>
	return createItems([])
}

test('Enter adds the leading suggestion, clears the query and keeps the palette open', async () => {
	await renderPalette()
	await type('uniswap fees')
	await pressKey('Enter')

	expect(mocks.appendItems).toHaveBeenCalledOnce()
	const [item] = appendedItems() as [ChartConfig]
	expect(item.kind).toBe('chart')
	expect(item.type).toBe('fees')
	expect(item.subjectType).toBe('protocol')
	expect(item.subjectType === 'protocol' ? item.protocol : null).toBe('uniswap')
	expect(input().value).toBe('')
	expect(statusText()).toContain('Added Uniswap · Fees')
	expect(onClose).not.toHaveBeenCalled()
	expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
	expect(mocks.pushRecent).toHaveBeenCalledWith({
		subjectType: 'protocol',
		id: 'uniswap',
		name: 'Uniswap',
		kind: 'chart',
		metric: 'fees'
	})
})

test('Shift+Enter adds and closes, revealing the added card', async () => {
	await renderPalette()
	await type('uniswap fees')
	await pressKey('Enter', { shiftKey: true })

	expect(mocks.appendItems).toHaveBeenCalledOnce()
	expect(onClose).toHaveBeenCalledOnce()
	expect(mocks.reveal).toHaveBeenCalledWith('added-item')
})

test('closing after an add reveals the last added card once', async () => {
	await renderPalette()
	await type('uniswap fees')
	await pressKey('Enter')
	expect(mocks.reveal).not.toHaveBeenCalled()

	await pressKey('Escape')

	expect(mocks.reveal).toHaveBeenCalledExactlyOnceWith('added-item')
	expect(onClose).toHaveBeenCalledOnce()
})

test('a dashboard that cannot take items yet answers with a toast and no status', async () => {
	mocks.appendItems.mockImplementation(() => false)
	await renderPalette()
	await type('uniswap fees')
	await pressKey('Enter')

	expect(toastMock.error).toHaveBeenCalledWith('The dashboard is still loading. Try again in a moment.', {
		id: 'dashboard-not-ready'
	})
	expect(statusText()).not.toContain('Added')
	expect(input().value).toBe('uniswap fees')
})

test('the footer and the last row open the full editor', async () => {
	await renderPalette({ afterItemId: 'card-1' })
	const footerButton = Array.from(document.body.querySelectorAll('button')).find(
		(node) => node.textContent?.trim() === 'All card types…'
	)
	await act(async () => footerButton!.click())

	expect(onOpenFullEditor).toHaveBeenCalledWith({ placement: { afterItemId: 'card-1' } })

	const lastRow = rows().at(-1)
	expect(lastRow?.textContent).toContain('All card types…')
	await act(async () => lastRow!.click())

	expect(onOpenFullEditor).toHaveBeenCalledTimes(2)
	expect(mocks.appendItems).not.toHaveBeenCalled()
})

test('Tab on the leading row opens the full editor with that card as a draft', async () => {
	await renderPalette()
	await type('uniswap fees')
	await pressKey('Tab')

	expect(mocks.appendItems).not.toHaveBeenCalled()
	expect(onOpenFullEditor).toHaveBeenCalledOnce()
	const [options] = onOpenFullEditor.mock.calls[0] as [{ draftItem?: DashboardItemConfig }]
	expect(options.draftItem?.kind).toBe('chart')
	expect((options.draftItem as ChartConfig).type).toBe('fees')
})

test('a loading catalog still offers the commands beside a loading status', async () => {
	mocks.protocolsLoading = true
	await renderPalette()

	expect(statusText()).toContain('Loading protocols…')
	const titles = rows().map((row) => row.textContent ?? '')
	expect(titles.some((title) => title.includes('Text block'))).toBe(true)
	expect(titles.at(-1)).toContain('All card types…')
})

test('an empty query groups the starting points', async () => {
	mocks.items = [{ id: 'tvl-uniswap', kind: 'chart', subjectType: 'protocol', protocol: 'uniswap', type: 'tvl' }]
	await renderPalette()

	expect(document.body.textContent).toContain('Suggested for this dashboard')
	expect(document.body.textContent).toContain('Start with')
	expect(rows()[0]?.textContent).toContain('Uniswap · Fees')
})

test('the table row is appended with the placement like any other card', async () => {
	await renderPalette({ afterItemId: 'card-1' })
	await type('table')
	await pressKey('Enter')

	expect(mocks.appendItems).toHaveBeenCalledOnce()
	expect(mocks.appendItems.mock.calls[0]?.[1]).toEqual({ afterItemId: 'card-1' })
	expect(appendedItems()[0]).toMatchObject({ kind: 'unified-table', strategy: 'protocols' })
	expect(statusText()).toContain('Added Top protocols table')
})

test('the table row answers the not ready dashboard with a toast', async () => {
	mocks.appendItems.mockImplementation(() => false)
	await renderPalette()
	await type('table')
	await pressKey('Enter')

	expect(toastMock.error).toHaveBeenCalledWith('The dashboard is still loading. Try again in a moment.', {
		id: 'dashboard-not-ready'
	})
	expect(statusText()).not.toContain('Added')
})

test('the text row opens the full editor with a text draft instead of appending a blank card', async () => {
	await renderPalette()
	await type('text')
	await pressKey('Enter')

	expect(mocks.appendItems).not.toHaveBeenCalled()
	expect(onOpenFullEditor).toHaveBeenCalledOnce()
	const [options] = onOpenFullEditor.mock.calls[0] as [{ draftItem?: DashboardItemConfig }]
	expect(options.draftItem).toMatchObject({ kind: 'text', content: '', colSpan: 1 })
})

test('the section row closes the palette and focuses the new heading title', async () => {
	await renderPalette()
	await type('section')
	await pressKey('Enter')

	expect(appendedItems()[0]).toMatchObject({ kind: 'section', title: 'New section' })
	expect(mocks.reveal).toHaveBeenCalledExactlyOnceWith('added-item', { focusTitle: true })
	expect(onClose).toHaveBeenCalledOnce()
	expect(statusText()).not.toContain('Added')
})

test('a metric already on the dashboard says so instead of its detail', async () => {
	mocks.items = [{ id: 'tvl-uniswap', kind: 'chart', subjectType: 'protocol', protocol: 'uniswap', type: 'tvl' }]
	await renderPalette()
	await type('uniswap tvl')

	expect(rows()[0]?.textContent).toContain('Already on dashboard')
	expect(rows()[0]?.textContent).toContain('Uniswap · TVL')
})

test('a pending metadata fetch marks the rows as still checking data', async () => {
	mocks.metadataLoading = true
	await renderPalette()
	await type('uniswap fees')

	expect(rows()[0]?.textContent).toContain('checking data…')
})

test('a failed metadata fetch keeps the rows without the checking data note', async () => {
	mocks.metadataError = 'boom'
	await renderPalette()
	await type('uniswap treasury')

	expect(rows()[0]?.textContent).toContain('Uniswap · Treasury')
	expect(rows()[0]?.textContent).not.toContain('checking data…')
})

test('clicking a row that is not the first one adds that row', async () => {
	await renderPalette()
	await type('uniswap fees')
	const secondRow = rows()[1]
	expect(secondRow?.textContent).toContain('Uniswap · Fees')
	await act(async () => secondRow!.click())

	expect(mocks.appendItems).toHaveBeenCalledOnce()
	expect(appendedItems()[0]).toMatchObject({ kind: 'metric', type: 'fees' })
})

test('Shift+Tab leaves the focus order alone', async () => {
	await renderPalette()
	await type('uniswap fees')
	await pressKey('Tab', { shiftKey: true })

	expect(onOpenFullEditor).not.toHaveBeenCalled()
	expect(mocks.appendItems).not.toHaveBeenCalled()
})

test('Enter in the same tick as the typing adds the row for the query just typed', async () => {
	await renderPalette()
	const field = input()
	field.focus()
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, 'aave revenue')
		field.dispatchEvent(new Event('input', { bubbles: true }))
		field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
	})

	expect(mocks.appendItems).toHaveBeenCalledOnce()
	expect(appendedItems()[0]).toMatchObject({ kind: 'chart', type: 'revenue', protocol: 'aave' })
})

test('Enter is ignored while an IME composition is in progress', async () => {
	await renderPalette()
	await type('uniswap fees')
	await pressKey('Enter', { isComposing: true })

	expect(mocks.appendItems).not.toHaveBeenCalled()
	expect(input().value).toBe('uniswap fees')
})

test('a comparison row is not replayed as a single chart recent', async () => {
	await renderPalette()
	await type('uniswap vs aave revenue')
	await pressKey('Enter')

	expect(appendedItems()[0]?.kind).toBe('multi')
	expect(mocks.pushRecent).not.toHaveBeenCalled()
})

test('the palette reports it has finished leaving so its session can be dropped', async () => {
	await renderPalette()
	expect(onClosed).not.toHaveBeenCalled()

	await act(async () =>
		root.render(
			<QuickAddPalette open={false} onClose={onClose} onClosed={onClosed} onOpenFullEditor={onOpenFullEditor} />
		)
	)

	expect(document.body.querySelector('[role="dialog"]')).toBeNull()
	expect(onClosed).toHaveBeenCalledOnce()
})
