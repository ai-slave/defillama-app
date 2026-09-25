// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/test/subscriberSession'
import { BalanceSettings } from './BalanceSettings'

const session = installSubscriberSession('reader')
const BALANCE_URL = 'https://features.llama.fi/user/ai-balance'
let balance = { freeRemaining: '3', toppedUpBalance: '7', freeLimit: '5', freeSpent: '2' }
let balanceFails = false
const balanceReads = () => session.requests.filter((request) => request.url.href === BALANCE_URL).length
let root: Root
let host: HTMLDivElement

beforeEach(() => {
	balance = { freeRemaining: '3', toppedUpBalance: '7', freeLimit: '5', freeSpent: '2' }
	balanceFails = false
	session.client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
	session.serve({
		[BALANCE_URL]: () => (balanceFails ? new Response('down', { status: 500 }) : Response.json(balance)),
		'https://features.llama.fi/topup/create': () => new Response('test checkout', { status: 500 })
	})
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
})
afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
	vi.useRealTimers()
})

async function draw(node: ReactNode) {
	await act(async () => root.render(<session.Wrapper>{node}</session.Wrapper>))
}
async function settle(assertion: () => void) {
	await act(async () => {
		await vi.waitFor(assertion)
	})
}
// Balance polling runs on timers; everything else (auth, query batching, fetch) runs as it does in the app.
async function advance(ms: number) {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms)
	})
}
function button(text: string) {
	return [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text))
}

test('shows the balance and top-up form without starting a payment or nesting a dialog', async () => {
	await draw(<BalanceSettings />)
	await settle(() => expect(host.textContent).toContain('$10.00'))
	await settle(() => expect(host.querySelector('input')?.value).toBe('10'))
	expect(host.querySelector('[role="dialog"]')).toBeNull()
	expect(host.textContent).not.toContain('Refresh')
	expect(session.requests.some((request) => request.url.pathname === '/topup/create')).toBe(false)
})

test('payment return polls the balance twice, then stops and offers a manual refresh', async () => {
	vi.useFakeTimers({ shouldAdvanceTime: true })
	await draw(<BalanceSettings result="success" />)
	await settle(() => expect(host.textContent).toContain('$10.00'))
	const afterMount = balanceReads()
	expect(button('Refresh balance')).toBeUndefined()
	await advance(4000)
	expect(balanceReads()).toBe(afterMount + 1)
	await advance(8000)
	expect(balanceReads()).toBe(afterMount + 2)
	await advance(60_000)
	expect(balanceReads()).toBe(afterMount + 2)
	await act(async () => button('Refresh balance')!.click())
	await settle(() => expect(balanceReads()).toBe(afterMount + 3))
	expect(host.textContent).toContain('may take a moment')
})

test('cancellation does not poll or claim payment succeeded', async () => {
	vi.useFakeTimers({ shouldAdvanceTime: true })
	await draw(<BalanceSettings result="cancelled" />)
	await settle(() => expect(host.textContent).toContain('$10.00'))
	const afterMount = balanceReads()
	await advance(15_000)
	expect(balanceReads()).toBe(afterMount)
	expect(host.textContent).toContain('Payment cancelled')
})

test('crypto checkout returns to Balance with separate completion and cancel results', async () => {
	await draw(<BalanceSettings />)
	await settle(() => expect(button('Pay with Crypto')).toBeDefined())
	await act(async () => button('Pay with Crypto')!.click())
	await settle(() => expect(session.requests.some((request) => request.url.pathname === '/topup/create')).toBe(true))
	const topup = session.requests.find((request) => request.url.pathname === '/topup/create')!
	const body = JSON.parse(topup.init!.body as string)
	for (const [key, result] of [
		['redirectUrl', 'success'],
		['cancelUrl', 'cancelled']
	]) {
		const url = new URL(body[key])
		expect(url.searchParams.get('modal')).toBe('settings')
		expect(url.searchParams.get('tab')).toBe('balance')
		expect(url.searchParams.get('topup')).toBe(result)
	}
})

test('accounts without an active subscription can see balance but cannot start a payment', async () => {
	session.serve({ '/subscription/status': () => new Response(null, { status: 404 }) })
	await draw(<BalanceSettings />)
	await settle(() => expect(host.textContent).toContain('$10.00'))
	await settle(() => expect(host.textContent).toContain('Subscribe to a plan'))
	expect(host.querySelector('input')).toBeNull()
})

test('failed balance reads offer a retry that reads the balance again', async () => {
	balanceFails = true
	await draw(<BalanceSettings />)
	await settle(() => expect(button('Refresh balance')).toBeDefined())
	balanceFails = false
	await act(async () => button('Refresh balance')!.click())
	await settle(() => expect(host.textContent).toContain('$10.00'))
})

test('an increased balance resolves the notice and then dismisses it', async () => {
	vi.useFakeTimers({ shouldAdvanceTime: true })
	await draw(<BalanceSettings result="success" />)
	await settle(() => expect(host.textContent).toContain('$10.00'))
	balance = { ...balance, toppedUpBalance: '17' }
	await advance(4000)
	await settle(() => expect(host.textContent).toContain('Balance updated'))
	expect(host.textContent).toContain('Your current balance is $20.00')
	expect(button('Refresh balance')).toBeUndefined()
	await advance(5000)
	expect(host.textContent).not.toContain('Balance updated')
	expect(host.textContent).not.toContain('Checking your payment')
})
