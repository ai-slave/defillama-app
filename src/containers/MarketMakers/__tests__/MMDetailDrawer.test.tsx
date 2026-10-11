// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { MMDetailDrawer } from '../MMDetailDrawer'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, pathname: '/market-makers', push: vi.fn() }) }))
const http = installFixtureFetch()
const detail = {
	id: 'lhava',
	name: 'Lhava',
	description: 'A liquidity provider',
	countryCode: 'SG',
	website: 'https://lhava.io',
	imageUrl: 'https://img.example/lhava.png',
	activeEngagementsCount: 12,
	averageFDV: 250_000_000,
	engagementOptions: ['loan_call_option', 'retainer_working_capital'],
	services: ['Treasury Management', 'OTC Liquidation'],
	supportedCEX: [{ label: 'Binance', value: 'binance', url: 'https://img.example/binance.png', order: 1, type: 'CEX' }],
	supportedDEX: [
		{ label: 'Uniswap V3', value: 'uniswap-v3', url: 'https://img.example/uni.png', order: 2, type: 'DEX' }
	]
}
const performance = {
	marketMakerId: 'lhava',
	composite: 9.5,
	tradingKpis: 8.25,
	trustIntegration: 7,
	coverageCapabilities: 6,
	uptime: 5,
	integrationLevel: 4,
	integrationStatus: 'full'
}
let root: Root
let container: HTMLDivElement
let client: QueryClient
beforeEach(() => {
	installChartCanvas()
	// The drawer's queries retry once; no delay keeps a failing request inside the test budget.
	client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	http.serve({
		'/api/public/market-makers/details': [detail],
		'/api/public/market-makers/performance': [performance],
		'/api/public/market-makers/aggregated': [{ marketMakerId: 'lhava', rank: { value: 1, percentile: 99 } }],
		'/api/public/market-makers/depth': { depth200: [{ marketMakerId: 'lhava', rank: { value: 2, percentile: 95 } }] },
		'/api/public/market-makers/volume': [
			{
				marketMakerId: 'lhava',
				rank: { value: 3, percentile: 90 },
				orderFillVolumeTotal: { value: 1234, percentile: 90, rank: 3 }
			}
		],
		'/api/public/market-makers/spread': [{ marketMakerId: 'lhava', rank: { value: 4, percentile: 85 } }],
		'/api/public/market-makers/kpi': [{ marketMakerId: 'lhava', rank: { value: 5, percentile: 80 } }]
	})
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
	vi.restoreAllMocks()
})
async function mount() {
	const close = vi.fn()
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<MMDetailDrawer open onClose={close} marketMakerId="lhava" range={{}} badge="Last 30-day" />
			</QueryClientProvider>
		)
	)
	return close
}

test('loads the selected market maker and renders its scores, services and venue names', async () => {
	const close = await mount()
	await waitForUi(async () => {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10))
		})
		// Description, scores and rank come from separate requests; wait for all three.
		const text = document.querySelector('[role="dialog"]')?.textContent
		expect(text).toContain('A liquidity provider')
		expect(text).toContain('9.50/10.00')
		expect(text).toContain('Outperformed 99%')
	})
	const dialog = document.querySelector('[role="dialog"]')!
	expect(dialog.textContent).toContain('Singapore')
	expect(dialog.textContent).toContain('Fully integrated')
	expect(dialog.textContent).toContain('Loan + Call Option')
	expect(dialog.textContent).toContain('Retainer + Working Capital')
	expect(dialog.textContent).toContain('Binance')
	expect(dialog.textContent).toContain('Uniswap V3')
	expect(dialog.textContent).toContain('Treasury Management')
	await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!.click())
	expect(close).toHaveBeenCalledOnce()
})

test('says the market maker failed to load instead of showing zero scores when a request fails', async () => {
	http.serve({ '/api/public/market-makers/performance': fixtureStatus(404) })
	await mount()
	await waitForUi(() => {
		expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toBe(
			"Couldn't load this market maker."
		)
	})
	expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('/10.00')
})

test('Try again reloads the market maker after a failed request and keeps focus in the drawer', async () => {
	http.serve({ '/api/public/market-makers/performance': fixtureStatus(404) })
	await mount()
	const tryAgain = () =>
		[...document.querySelectorAll('[role="dialog"] button')].find((button) => accessibleName(button) === 'Try again')
	await waitForUi(() => expect(tryAgain()).toBeInstanceOf(HTMLButtonElement))
	// Held until the loading screen has replaced Try again, as a real network would.
	let respond = () => {}
	http.serve({
		'/api/public/market-makers/performance': () => new Promise((resolve) => (respond = () => resolve([performance])))
	})
	await act(async () => {
		const button = tryAgain() as HTMLButtonElement
		button.focus()
		button.click()
	})
	await waitForUi(() => expect(tryAgain()).toBeUndefined())
	await act(async () => respond())
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')?.textContent).toContain('9.50/10.00'))
	expect(document.querySelector('[role="dialog"] [role="alert"]')).toBeNull()
	expect(document.activeElement).toBe(
		[...document.querySelectorAll('[role="dialog"] button')].find((button) => accessibleName(button) === 'Close dialog')
	)
})

test('the click that opens a lead form records one click id, and the sent lead carries it', async () => {
	vi.stubEnv('NEXT_PUBLIC_CLAIMS_TURNSTILE_SITE_KEY', '')
	onTestFinished(() => {
		vi.unstubAllEnvs()
	})
	http.serve({
		'/api/public/market-makers/performance': [{ ...performance, integrationStatus: 'none' }],
		'/api/public/market-makers/cta': { clickId: 'click-1' },
		'/api/public/market-makers/lead/claim': { status: 'ok', request_id: 'req-1' }
	})
	// StrictMode mounts the form twice; the click, not the mount, records the id.
	await act(async () =>
		root.render(
			<StrictMode>
				<QueryClientProvider client={client}>
					<MMDetailDrawer open onClose={vi.fn()} marketMakerId="lhava" range={{}} badge="Last 30-day" />
				</QueryClientProvider>
			</StrictMode>
		)
	)
	const buttonNamed = (name: string) =>
		[...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => accessibleName(button) === name)!
	await waitForUi(() => expect(buttonNamed('Claim organization')).toBeDefined())
	await act(async () => buttonNamed('Claim organization').click())
	const ctaPosts = () => http.requests.filter((request) => request.url.pathname === '/api/public/market-makers/cta')
	await waitForUi(() => expect(ctaPosts()).toHaveLength(1))
	expect(JSON.parse(String(ctaPosts()[0].init?.body))).toMatchObject({ kind: 'claim', market_maker_id: 'lhava' })

	// Field labels point at their input with htmlFor.
	const field = (label: string) =>
		document.getElementById(
			[...document.querySelectorAll('label')].find((element) => element.textContent?.includes(label))!.htmlFor
		) as HTMLInputElement
	const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
	for (const [label, value] of [
		['Position at organization', 'CEO'],
		['Your full name', 'Ada Lovelace'],
		['Your LinkedIn or X profile', 'linkedin.com/in/ada'],
		['Your organization email address', 'ada@acme.com']
	]) {
		await act(async () => {
			setValue.call(field(label), value)
			field(label).dispatchEvent(new Event('input', { bubbles: true }))
		})
	}
	const leadDialog = [...document.querySelectorAll('[role="dialog"]')].at(-1)!
	for (const checkbox of leadDialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
		await act(async () => checkbox.click())
	}
	await act(async () => buttonNamed('Submit claim request').click())
	const lead = () => http.requests.find((request) => request.url.pathname === '/api/public/market-makers/lead/claim')
	await waitForUi(() => expect(lead()).toBeDefined())
	expect(JSON.parse(String(lead()!.init?.body))).toMatchObject({ click_id: 'click-1', market_maker_id: 'lhava' })
	expect(ctaPosts()).toHaveLength(1)
})
