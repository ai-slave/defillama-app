// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AUTH_SERVER } from '~/constants'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { PaymentButton } from '../Crypto'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/subscription', query: {} }) }))

const session = installSubscriberSession('crypto-buyer', { account: 'free', resolved: true })
const CREATE = `${AUTH_SERVER}/subscription/create`

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	session.serve({ '/subscription/trial-available': { trialAvailable: false } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const payWithCrypto = () =>
	[...document.querySelectorAll('button')].find((button) => accessibleName(button) === 'Pay with Crypto')!
const alert = () => document.querySelector('[role="alert"]')

test('a failed crypto checkout says so under the button and clears on the next attempt', async () => {
	session.serve({ [CREATE]: () => Response.json({ message: 'LlamaPay is unavailable' }, { status: 503 }) })
	await act(async () =>
		root.render(
			<session.Wrapper>
				<PaymentButton paymentMethod="llamapay" />
			</session.Wrapper>
		)
	)

	await act(async () => payWithCrypto().click())
	await waitForUi(() => expect(alert()).not.toBeNull())
	// A 5xx body is not written for readers.
	expect(alert()!.textContent).not.toContain('LlamaPay is unavailable')

	const retry = Promise.withResolvers<Response>()
	session.serve({ [CREATE]: () => retry.promise })
	await act(async () => payWithCrypto().click())
	expect(alert()).toBeNull()

	await act(async () => retry.resolve(Response.json({ message: 'Still unavailable' }, { status: 409 })))
	await waitForUi(() => expect(alert()?.textContent).toBe('Still unavailable'))
})
