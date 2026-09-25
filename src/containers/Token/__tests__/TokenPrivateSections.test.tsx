// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { fixtureStatus } from '~/utils/test/fixtureFetch'
import { installSubscriberSession } from '~/utils/test/subscriberSession'
import { TokenLiquidationsSection } from '../TokenLiquidationsSection'
import { TokenUnlocksSection } from '../TokenUnlocksSection'
import { TokenUsageSection } from '../TokenUsageSection'

vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/token/link', query: {}, pathname: '/token/[token]' }) }))
// Heavy children the assertions below never read.
vi.mock('~/containers/Subscription/SignInModal', () => ({ SignInModal: () => null }))
vi.mock('~/containers/Unlocks/EmissionsByProtocol', () => ({ UnlocksCharts: () => null }))

const session = installSubscriberSession('token-subscriber')

// The sections load their table lazily; loading it once up front keeps the first render inside waitFor's bound.
beforeAll(() => import('~/components/Table/PaginatedTable'))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function render(section: ReactNode) {
	await act(async () => root.render(<session.Wrapper>{section}</session.Wrapper>))
}

test('a subscriber sees token usage by descending amount, with CEXs only after opting in', async () => {
	session.serve({
		'/api/private/token-usage/LINK': [
			{ name: 'Aave', category: 'Lending', amountUsd: { ethereum: 100, base: 50 }, slug: 'aave' },
			{ name: 'Binance', category: 'CEX', amountUsd: { ethereum: 900 } },
			{ name: 'Compound', category: 'Lending', amountUsd: { ethereum: 300 }, slug: 'compound' }
		]
	})
	await render(<TokenUsageSection tokenSymbol="link" />)

	const names = () => [...container.querySelectorAll('tbody tr')].map((row) => row.querySelector('td')?.textContent)
	await vi.waitFor(() => expect(names()).toEqual(['Compound', 'Aave']))

	const includeCexs = [...container.querySelectorAll('label')].find((label) => label.textContent === 'Include CEXs')!
	await act(async () => includeCexs.click())

	await vi.waitFor(() => expect(names()).toEqual(['Binance', 'Compound', 'Aave']))
})

test('a subscriber sees the server reason when token unlocks fail to load', async () => {
	session.serve({ '/api/private/token-unlocks/solana': fixtureStatus(503, { error: 'Unlocks are being rebuilt' }) })
	await render(<TokenUnlocksSection resolvedUnlocksSlug="solana" />)

	await vi.waitFor(() => expect(container.textContent).toContain('Unlocks are being rebuilt'))
})

test('the liquidations section shows a token with positions and stays hidden for one without', async () => {
	const liquidations = (tokenSymbol: string, positionCount: number) => ({
		tokenSymbol,
		timestamp: 1,
		positionCount,
		protocolCount: positionCount ? 1 : 0,
		chainCount: positionCount ? 1 : 0,
		totalCollateralUsd: positionCount * 1000,
		distributionChart: { tokens: [] },
		protocolRows: positionCount
			? [
					{
						id: 'aave',
						name: 'Aave',
						slug: 'aave',
						positionCount,
						chainCount: 1,
						collateralCount: 1,
						totalCollateralUsd: 1000
					}
				]
			: [],
		chainRows: positionCount
			? [
					{
						id: 'ethereum',
						name: 'Ethereum',
						slug: 'ethereum',
						positionCount,
						protocolCount: 1,
						collateralCount: 1,
						totalCollateralUsd: 1000
					}
				]
			: []
	})
	session.serve({
		'/api/private/token-liquidations/wstETH': liquidations('WSTETH', 3),
		'/api/private/token-liquidations/rETH': liquidations('RETH', 0)
	})
	await render(<TokenLiquidationsSection tokenSymbol="wstETH" />)
	await vi.waitFor(() => expect(container.textContent).toContain('Liquidations'))

	await render(<TokenLiquidationsSection tokenSymbol="rETH" />)
	await vi.waitFor(() =>
		expect(session.requests.some((request) => request.url.pathname === '/api/private/token-liquidations/rETH')).toBe(
			true
		)
	)
	await vi.waitFor(() => expect(container.textContent).toBe(''))
})
