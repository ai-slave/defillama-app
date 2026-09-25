// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TokenLiquidationsSection } from '~/containers/Token/TokenLiquidationsSection'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { LiquidationsChainPage } from '../ChainPage'
import { LiquidationsOverview } from '../index'
import { LiquidationsProtocolPage } from '../ProtocolPage'

vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/liquidations', asPath: '/liquidations', query: {}, push() {}, replace() {} })
}))
// Heavy children the tab contract does not read.
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('~/components/RowLinksWithDropdown', () => ({ RowLinksWithDropdown: () => null }))
vi.mock('../LiquidationsDistributionChart', () => ({ LiquidationsDistributionChart: () => null }))

const session = installSubscriberSession('subscriber')

const ref = (name: string) => ({ id: name.toLowerCase(), name, slug: name.toLowerCase() })
const protocolRow = (name: string, totalCollateralUsd: number) => ({
	...ref(name),
	positionCount: 1,
	chainCount: 1,
	collateralCount: 1,
	totalCollateralUsd
})
const chainRow = (name: string, totalCollateralUsd: number) => ({
	...ref(name),
	protocolId: 'aave',
	protocolName: 'Aave',
	protocolSlug: 'aave',
	positionCount: 1,
	protocolCount: 1,
	collateralCount: 1,
	totalCollateralUsd
})
const position = (protocolName: string, collateralAmountUsd: number) => ({
	protocolId: protocolName.toLowerCase(),
	protocolName,
	protocolSlug: protocolName.toLowerCase(),
	chainId: 'ethereum',
	chainName: 'Ethereum',
	chainSlug: 'ethereum',
	owner: `0x${protocolName}`,
	liqPrice: 1000,
	collateral: 'ETH',
	collateralId: 'eth',
	collateralAmount: 1,
	collateralAmountUsd
})
// Every table defaults to the largest collateral first, so the smaller row comes second.
const props = {
	protocolLinks: [],
	chainLinks: [],
	timestamp: 100,
	protocolCount: 2,
	chainCount: 2,
	positionCount: 2,
	collateralCount: 1,
	totalCollateralUsd: 350_000,
	distributionChart: { tokens: [] },
	protocolId: 'aave',
	protocolName: 'Aave',
	protocolSlug: 'aave',
	chainId: 'ethereum',
	chainName: 'Ethereum',
	chainSlug: 'ethereum',
	protocolRows: [protocolRow('Spark', 100_000), protocolRow('Aave', 200_000)],
	chainRows: [chainRow('Arbitrum', 50_000), chainRow('Ethereum', 300_000)],
	ownerBlockExplorers: [],
	positions: [position('Spark', 100_000), position('Aave', 200_000)]
}
const cases = [
	{
		name: 'overview',
		render: () => <LiquidationsOverview {...props} />,
		labels: ['Protocols', 'Chains'],
		firstRows: ['Aave', 'Spark'],
		secondRows: ['Ethereum', 'Arbitrum']
	},
	{
		name: 'protocol',
		render: () => <LiquidationsProtocolPage {...props} />,
		labels: ['Chains', 'Positions'],
		firstRows: ['Ethereum', 'Arbitrum'],
		secondRows: ['Aave', 'Spark']
	},
	{
		name: 'chain',
		render: () => <LiquidationsChainPage {...props} />,
		labels: ['Positions', 'Chains'],
		firstRows: ['Aave', 'Spark'],
		secondRows: ['Ethereum', 'Arbitrum']
	}
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

async function mount(ui: ReactNode) {
	await act(async () => root.render(<session.Wrapper>{ui}</session.Wrapper>))
}
async function press(element: HTMLElement, key: string) {
	await act(async () => {
		element.focus()
		element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}
const tabs = () => [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
const search = () => container.querySelector<HTMLInputElement>('[role="tabpanel"] input')!
async function type(value: string) {
	await act(async () => {
		search().value = value
		search().dispatchEvent(new Event('input', { bubbles: true }))
	})
}
async function sortByCollateral() {
	const header = [...container.querySelectorAll<HTMLButtonElement>('thead button')].find(
		(button) => button.textContent === 'Collateral USD'
	)!
	await act(async () => header.click())
}
// The first cell of each rendered row names the protocol or chain.
const rowNames = () =>
	[...container.querySelectorAll('[role="tabpanel"] tbody tr:not([aria-hidden])')].map(
		(row) => row.querySelector('td')!.textContent
	)
function expectPanel(tab: HTMLButtonElement) {
	const panel = container.querySelector<HTMLElement>('[role="tabpanel"]')!
	expect(tab.getAttribute('aria-selected')).toBe('true')
	expect(tab.getAttribute('aria-controls')).toBe(panel.id)
	expect(panel.getAttribute('aria-labelledby')).toBe(tab.id)
	expect(panel.hidden).toBe(false)
	expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1)
}

test.each(cases)(
	'$name moves focus without switching views and resets search and sorting on a new view',
	async ({ render, labels, firstRows, secondRows }) => {
		await mount(render())
		const [first, second] = tabs()
		expect([first.textContent, second.textContent]).toEqual(labels)
		expectPanel(first)
		expect(rowNames()).toEqual(firstRows)

		await sortByCollateral()
		expect(rowNames()).toEqual([...firstRows].reverse())
		await type('no matching rows')
		expect(rowNames()).toEqual([])

		await press(first, 'ArrowRight')
		expect(document.activeElement).toBe(second)
		expectPanel(first)
		expect(search().value).toBe('no matching rows')
		expect(rowNames()).toEqual([])

		await press(second, 'Enter')
		expect(document.activeElement).toBe(second)
		expectPanel(second)
		expect(search().value).toBe('')
		expect(rowNames()).toEqual(secondRows)

		await press(second, 'Home')
		expect(document.activeElement).toBe(first)
		expectPanel(second)
		await press(first, ' ')
		expectPanel(first)
		expect(document.activeElement).toBe(first)
		expect(search().value).toBe('')
		expect(rowNames()).toEqual(firstRows)

		await press(first, 'End')
		expect(document.activeElement).toBe(second)
		expectPanel(first)
	}
)

test('token liquidations keeps search and sorting across views without losing focus', async () => {
	session.serve({
		'/api/private/token-liquidations/ETH': {
			tokenSymbol: 'ETH',
			timestamp: 100,
			positionCount: 2,
			protocolCount: 2,
			chainCount: 2,
			totalCollateralUsd: 350_000,
			distributionChart: { tokens: [] },
			protocolRows: props.protocolRows,
			chainRows: props.chainRows
		}
	})
	await mount(<TokenLiquidationsSection tokenSymbol="ETH" />)
	await vi.waitFor(async () => {
		await act(async () => {})
		expect(tabs()).toHaveLength(2)
		expect(rowNames()).toEqual(['Aave', 'Spark'])
	})
	const [first, second] = tabs()
	expectPanel(first)

	// "um" matches both chains and neither protocol.
	await sortByCollateral()
	await type('um')
	expect(rowNames()).toEqual([])

	await press(first, 'ArrowRight')
	expectPanel(first)
	await press(second, 'Enter')
	expectPanel(second)
	expect(document.activeElement).toBe(second)
	expect(search().value).toBe('um')
	expect(rowNames()).toEqual(['Arbitrum', 'Ethereum'])

	await press(second, 'Home')
	await press(first, ' ')
	expectPanel(first)
	expect(document.activeElement).toBe(first)
	expect(search().value).toBe('um')
	await type('')
	expect(rowNames()).toEqual(['Spark', 'Aave'])
})
