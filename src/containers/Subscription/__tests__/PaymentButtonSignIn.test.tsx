// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com/mcp"}

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import pb from '~/utils/pocketbase'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { PaymentButton } from '../Crypto'

vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/mcp', pathname: '/mcp', query: {} }) }))
// The real sign-in dialog, without the wallet picker, Turnstile and third-party scripts it loads.
vi.mock('next/script', () => ({ default: () => null }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('~/containers/Subscription/Turnstile', () => ({ Turnstile: () => null }))

const session = installSubscriberSession('api-buyer', { account: 'signed-out' })
let root: Root
beforeEach(async () => {
	session.serve({ '/subscription/trial-available': { trialAvailable: false } })
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<PaymentButton paymentMethod="stripe" type="api" />
			</session.Wrapper>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

const payWithCard = () =>
	[...document.querySelectorAll('button')].find((button) => accessibleName(button) === 'Pay with Card')

test('signing in from Pay with Card keeps the sign-in open through its signed-in step and keeps the button', async () => {
	await waitForUi(() => expect(payWithCard()).toBeDefined())
	await act(async () => payWithCard()!.click())
	await waitForUi(() => expect(document.querySelector('[role=dialog] h2')?.textContent).toBe('Sign in'))
	await act(async () => pb.authStore.save(session.token, session.record as never))
	await waitForUi(() => expect(document.querySelector('[role=dialog] h2')?.textContent).toBe("You're signed in"))
	expect(payWithCard()).toBeDefined()
})
