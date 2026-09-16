// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PaymentButton } from './Crypto'

const auth = vi.hoisted(() => ({
	user: { id: 'account', email: 'person@example.com', verified: false, walletAddress: undefined as string | undefined },
	promptVerifyEmail: vi.fn(),
	handleSubscribe: vi.fn()
}))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ isAuthenticated: true, user: auth.user, promptVerifyEmail: auth.promptVerifyEmail })
}))
vi.mock('~/auth/useSubscribe', () => ({
	useSubscribe: () => ({ loading: null, handleSubscribe: auth.handleSubscribe })
}))
vi.mock('./shared/StripeCheckoutModal', () => ({
	StripeCheckoutModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div role="dialog">Card checkout</div> : null)
}))
vi.mock('./SignInModal', () => ({ SignInModal: () => null }))

let container: HTMLDivElement
let root: Root
beforeEach(() => {
	vi.clearAllMocks()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test.each([
	{ verified: false, walletAddress: '0x1234', allowed: true },
	{ verified: true, walletAddress: undefined, allowed: true },
	{ verified: false, walletAddress: undefined, allowed: false }
])(
	'gates checkout correctly for verified=$verified and wallet=$walletAddress',
	async ({ verified, walletAddress, allowed }) => {
		auth.user = { id: 'account', email: 'person@example.com', verified, walletAddress }
		await act(async () =>
			root.render(
				<>
					<PaymentButton paymentMethod="stripe" />
					<PaymentButton paymentMethod="llamapay" />
				</>
			)
		)
		const buttons = container.querySelectorAll('button')
		await act(async () =>
			Array.from(buttons)
				.find((button) => button.textContent?.includes('Pay with Card'))!
				.click()
		)
		await act(async () =>
			Array.from(buttons)
				.find((button) => button.textContent?.includes('Pay with Crypto'))!
				.click()
		)
		expect(auth.promptVerifyEmail.mock.calls).toEqual(allowed ? [] : [['account'], ['account']])
		expect(container.querySelector('[role="dialog"]')?.textContent).toBe(allowed ? 'Card checkout' : undefined)
		expect(auth.handleSubscribe.mock.calls).toEqual(allowed ? [['llamapay', 'api', undefined, 'month', false]] : [])
	}
)
