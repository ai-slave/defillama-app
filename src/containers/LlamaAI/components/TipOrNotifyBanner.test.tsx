// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TipActionProvider } from './TipActionContext'
import { TipOrNotifyBanner } from './TipOrNotifyBanner'

const mocks = vi.hoisted(() => ({ totalAvailable: 0.5, open: vi.fn() }))
vi.mock('~/containers/Subscription/useTopup', () => ({
	useAiBalance: () => ({ balance: {}, totalAvailable: mocks.totalAvailable })
}))
vi.mock('~/containers/LlamaAI/hooks/useLlamaAITip', () => ({ useActiveTip: () => ({ tip: null }) }))
vi.mock('./NotificationPermissionBanner', () => ({ NotificationPermissionBanner: () => null }))
let root: Root
let host: HTMLDivElement
beforeEach(() => {
	vi.clearAllMocks()
	mocks.totalAvailable = 0.5
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
})
afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
})
const render = (id?: string) =>
	act(async () =>
		root.render(
			<TipActionProvider handlers={{ openSettingsModal: mocks.open }}>
				<TipOrNotifyBanner premiumResponseId={id} />
			</TipActionProvider>
		)
	)

test('shows low balance only after paid usage and opens the Balance tab', async () => {
	await render()
	expect(host.textContent).not.toContain('balance is low')
	await render('paid-message')
	expect(host.textContent).toContain('balance is low')
	const topup = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.textContent === 'Top up'
	)!
	await act(async () => topup.click())
	expect(mocks.open).toHaveBeenCalledWith('balance')
	await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Dismiss low balance notice"]')!.click())
	expect(host.textContent).not.toContain('balance is low')
	await render('paid-message')
	expect(host.textContent).not.toContain('balance is low')
})

test('a sufficient balance does not show a top-up notice', async () => {
	mocks.totalAvailable = 10
	await render('paid-message')
	expect(host.textContent).not.toContain('balance is low')
})
