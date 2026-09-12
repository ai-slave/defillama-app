// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { BalanceSettings } from './BalanceSettings'

const mocks = vi.hoisted(() => ({
	refetch: vi.fn(),
	mutateAsync: vi.fn(),
	reset: vi.fn(),
	subscribed: true,
	totalAvailable: 10,
	isError: false
}))
vi.mock('~/auth', () => ({ useAuthContext: () => ({ hasActiveSubscription: mocks.subscribed }) }))
vi.mock('~/containers/Subscription/useTopup', () => ({
	TOPUP_CONFIG: { minAmount: 1, maxAmount: 500, quickAmounts: [5, 10, 25, 50] },
	useAiBalance: () => ({
		balance: { freeRemaining: '3', toppedUpBalance: '7' },
		totalAvailable: mocks.totalAvailable,
		isLoading: false,
		isError: mocks.isError,
		refetch: mocks.refetch
	}),
	useCreateTopup: () => ({ mutateAsync: mocks.mutateAsync, reset: mocks.reset, isPending: false, error: null })
}))
let root: Root
let host: HTMLDivElement
beforeEach(() => {
	vi.clearAllMocks()
	mocks.subscribed = true
	mocks.totalAvailable = 10
	mocks.isError = false
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
})
afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
	vi.useRealTimers()
})

test('shows the balance and top-up form without starting a payment or nesting a dialog', async () => {
	await act(async () => root.render(<BalanceSettings />))
	expect(host.textContent).toContain('$10.00')
	expect(host.querySelector('input')?.value).toBe('10')
	expect(host.querySelector('[role="dialog"]')).toBeNull()
	expect(mocks.mutateAsync).not.toHaveBeenCalled()
	expect(host.textContent).not.toContain('Refresh')
	expect(mocks.refetch).toHaveBeenCalledTimes(1)
})

test('payment return schedules bounded balance reads and offers manual refresh', async () => {
	vi.useFakeTimers()
	await act(async () => root.render(<BalanceSettings result="success" />))
	expect(mocks.refetch).toHaveBeenCalledTimes(1)
	expect(host.textContent).not.toContain('Refresh balance')
	await act(async () => vi.advanceTimersByTime(4000))
	expect(mocks.refetch).toHaveBeenCalledTimes(2)
	await act(async () => vi.advanceTimersByTime(8000))
	expect(mocks.refetch).toHaveBeenCalledTimes(3)
	await act(async () => vi.advanceTimersByTime(60_000))
	expect(mocks.refetch).toHaveBeenCalledTimes(3)
	const refresh = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.textContent === 'Refresh balance'
	)!
	await act(async () => refresh.click())
	expect(mocks.refetch).toHaveBeenCalledTimes(4)
	expect(host.textContent).toContain('may take a moment')
})

test('cancellation does not poll or claim payment succeeded', async () => {
	vi.useFakeTimers()
	await act(async () => root.render(<BalanceSettings result="cancelled" />))
	await act(async () => vi.advanceTimersByTime(15_000))
	expect(mocks.refetch).toHaveBeenCalledTimes(1)
	expect(host.textContent).toContain('Payment cancelled')
})

test('leaving the tab cancels pending balance reads', async () => {
	vi.useFakeTimers()
	await act(async () => root.render(<BalanceSettings result="success" />))
	await act(async () => root.render(null))
	await act(async () => vi.advanceTimersByTime(15_000))
	expect(mocks.refetch).toHaveBeenCalledTimes(1)
})

test('crypto checkout returns to Balance with separate completion and cancel results', async () => {
	mocks.mutateAsync.mockRejectedValueOnce(new Error('test checkout'))
	await act(async () => root.render(<BalanceSettings />))
	const crypto = [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
		b.textContent?.includes('Pay with Crypto')
	)!
	await act(async () => crypto.click())
	const request = mocks.mutateAsync.mock.calls[0][0]
	for (const [key, result] of [
		['redirectUrl', 'success'],
		['cancelUrl', 'cancelled']
	]) {
		const url = new URL(request[key])
		expect(url.searchParams.get('modal')).toBe('settings')
		expect(url.searchParams.get('tab')).toBe('balance')
		expect(url.searchParams.get('topup')).toBe(result)
	}
})

test('accounts without an active subscription can see balance but cannot start a payment', async () => {
	mocks.subscribed = false
	await act(async () => root.render(<BalanceSettings />))
	expect(host.textContent).toContain('$10.00')
	expect(host.textContent).toContain('Subscribe to a plan')
	expect(host.querySelector('input')).toBeNull()
})

test('failed balance reads offer a retry', async () => {
	mocks.isError = true
	await act(async () => root.render(<BalanceSettings />))
	const retry = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.textContent === 'Refresh balance'
	)!
	await act(async () => retry.click())
	expect(mocks.refetch).toHaveBeenCalledTimes(2)
})

test('an increased balance resolves the notice and then dismisses it', async () => {
	vi.useFakeTimers()
	await act(async () => root.render(<BalanceSettings result="success" />))
	mocks.totalAvailable = 20
	await act(async () => root.render(<BalanceSettings result="success" />))
	expect(host.textContent).toContain('Balance updated')
	expect(host.textContent).toContain('Your current balance is $20.00')
	expect(host.textContent).not.toContain('Refresh balance')
	await act(async () => vi.advanceTimersByTime(5000))
	expect(host.textContent).not.toContain('Balance updated')
	expect(host.textContent).not.toContain('Checking your payment')
})
