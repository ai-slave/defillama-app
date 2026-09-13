import { useSelector } from '@tanstack/react-store'
import type { ReactTable } from '@tanstack/react-table'
// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { TokenLiquidationsSection } from '~/containers/Token/TokenLiquidationsSection'
import { LiquidationsChainPage } from '../ChainPage'
import { LiquidationsOverview } from '../index'
import { LiquidationsProtocolPage } from '../ProtocolPage'

vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@tanstack/react-query', () => ({
	useQuery: () => ({ data: { ...props, tokenSymbol: 'ETH' }, isLoading: false })
}))
vi.mock('~/containers/Token/TokenPrivateSectionGate', () => ({
	useTokenPrivateSectionAccess: () => ({
		isAuthenticated: true,
		hasActiveSubscription: true,
		loaders: { userLoading: false }
	}),
	TokenPrivateSectionGate: ({ children }: { children: React.ReactNode }) => children
}))
vi.mock('~/containers/Token/deferred/DeferredTokenLiquidationsTable', async () => ({
	DeferredTokenLiquidationsTable: (await import('~/containers/Token/TokenLiquidationsTable')).TokenLiquidationsTable
}))
vi.mock('~/components/RowLinksWithDropdown', () => ({ RowLinksWithDropdown: () => null }))
vi.mock('../LiquidationsDistributionChart', () => ({ LiquidationsDistributionChart: () => null }))
vi.mock('../Summary', () => ({ LiquidationsSummaryStats: () => null, LiquidationsPageHeader: () => null }))
vi.mock('~/components/CsvDownloadButton', () => ({ CSVDownloadButton: () => <button type="button">Export</button> }))
vi.mock('~/components/Table/VirtualTable', () => ({
	VirtualTable: ({ table: instance }: { table: ReactTable<SearchTableFeatures, unknown> }) => {
		const state = useSelector(instance.store)
		const rows = useSelector(instance.store, () => instance.getRowModel().rows)
		return (
			<div data-testid="table" data-sort={JSON.stringify(state.sorting)}>
				<button type="button" onClick={() => instance.getColumn(state.sorting[0].id)!.toggleSorting(false)}>
					Sort ascending
				</button>
				<output>{rows.length} rows</output>
			</div>
		)
	}
}))

const chain = {
	id: 'ethereum',
	name: 'Ethereum',
	slug: 'ethereum',
	protocolId: 'aave',
	protocolName: 'Aave',
	protocolSlug: 'aave',
	positionCount: 1,
	collateralCount: 1,
	totalCollateralUsd: 200_000,
	protocolCount: 1
}
const props = {
	protocolLinks: [],
	chainLinks: [],
	timestamp: 100,
	protocolCount: 1,
	chainCount: 1,
	positionCount: 1,
	collateralCount: 1,
	totalCollateralUsd: 200_000,
	distributionChart: { tokens: [] },
	protocolId: 'aave',
	protocolName: 'Aave',
	protocolSlug: 'aave',
	chainId: 'ethereum',
	chainName: 'Ethereum',
	chainSlug: 'ethereum',
	protocolRows: [
		{
			id: 'aave',
			name: 'Aave',
			slug: 'aave',
			positionCount: 1,
			chainCount: 1,
			collateralCount: 1,
			totalCollateralUsd: 200_000
		}
	],
	chainRows: [chain],
	ownerBlockExplorers: [],
	positions: [
		{
			protocolId: 'aave',
			protocolName: 'Aave',
			protocolSlug: 'aave',
			chainId: 'ethereum',
			chainName: 'Ethereum',
			chainSlug: 'ethereum',
			owner: '0x123',
			liqPrice: 1000,
			collateral: 'ETH',
			collateralId: 'eth',
			collateralAmount: 100,
			collateralAmountUsd: 200_000
		}
	]
}
const cases = [
	{ name: 'overview', render: () => <LiquidationsOverview {...props} />, labels: ['Protocols', 'Chains'] },
	{ name: 'protocol', render: () => <LiquidationsProtocolPage {...props} />, labels: ['Chains', 'Positions'] },
	{ name: 'chain', render: () => <LiquidationsChainPage {...props} />, labels: ['Positions', 'Chains'] }
]
let container: HTMLDivElement
let root: Root
beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function press(element: HTMLElement, key: string) {
	await act(async () => {
		element.focus()
		element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}
function expectPanel(tab: HTMLButtonElement) {
	const panel = container.querySelector<HTMLElement>('[role="tabpanel"]')!
	expect(tab.getAttribute('aria-selected')).toBe('true')
	expect(tab.getAttribute('aria-controls')).toBe(panel.id)
	expect(panel.getAttribute('aria-labelledby')).toBe(tab.id)
	expect(panel.hidden).toBe(false)
	expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1)
}

test.each(cases)(
	'$name preserves focused tabs while selection resets the actual table state',
	async ({ render, labels }) => {
		await act(async () => root.render(render()))
		const [first, second] = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
		expect([first.textContent, second.textContent]).toEqual(labels)
		expectPanel(first)
		const search = container.querySelector<HTMLInputElement>('input')!
		const table = container.querySelector('[data-testid="table"]')!
		await act(async () => {
			search.value = 'no matching rows'
			search.dispatchEvent(new Event('input', { bubbles: true }))
			container.querySelector<HTMLButtonElement>('[data-testid="table"] button')!.click()
		})
		expect(container.querySelector('output')!.textContent).toBe('0 rows')
		expect(table.getAttribute('data-sort')).toContain('"desc":false')
		await press(first, 'ArrowRight')
		expect(document.activeElement).toBe(second)
		expectPanel(first)
		expect(container.querySelector('[data-testid="table"]')).toBe(table)
		expect(search.value).toBe('no matching rows')
		await press(second, 'Enter')
		expect(document.activeElement).toBe(second)
		expect(container.querySelectorAll('[role="tab"]')[1]).toBe(second)
		expectPanel(second)
		expect(container.querySelector('input')).not.toBe(search)
		expect(container.querySelector<HTMLInputElement>('input')!.value).toBe('')
		expect(container.querySelector('output')!.textContent).toBe('1 rows')
		await press(second, 'Home')
		expect(document.activeElement).toBe(first)
		expectPanel(second)
		await press(first, ' ')
		expectPanel(first)
		expect(document.activeElement).toBe(first)
		expect(container.querySelector('[data-testid="table"]')).not.toBe(table)
		expect(container.querySelector('[data-testid="table"]')!.getAttribute('data-sort')).toContain('"desc":true')
		expect(container.querySelector<HTMLInputElement>('input')!.value).toBe('')
		await press(first, 'End')
		expect(document.activeElement).toBe(second)
		expectPanel(first)
	}
)

test('token liquidations keeps search and sorting across views without losing focus', async () => {
	await act(async () => root.render(<TokenLiquidationsSection tokenSymbol="ETH" />))
	const [first, second] = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
	const search = container.querySelector<HTMLInputElement>('input')!
	const table = container.querySelector('[data-testid="table"]')!
	await act(async () => {
		search.value = 'Ethereum'
		search.dispatchEvent(new Event('input', { bubbles: true }))
		container.querySelector<HTMLButtonElement>('[data-testid="table"] button')!.click()
	})
	expectPanel(first)
	expect(container.querySelector('output')!.textContent).toBe('0 rows')
	await press(first, 'ArrowRight')
	expectPanel(first)
	await press(second, 'Enter')
	expectPanel(second)
	expect(document.activeElement).toBe(second)
	expect(container.querySelector('input')).toBe(search)
	expect(search.value).toBe('Ethereum')
	expect(container.querySelector('[data-testid="table"]')).toBe(table)
	expect(table.getAttribute('data-sort')).toContain('"desc":false')
	expect(container.querySelector('output')!.textContent).toBe('1 rows')
	await press(second, 'Home')
	await press(first, ' ')
	expectPanel(first)
	expect(document.activeElement).toBe(first)
	expect(search.value).toBe('Ethereum')
	expect(table.getAttribute('data-sort')).toContain('"desc":false')
	expect(container.querySelector('output')!.textContent).toBe('0 rows')
})
