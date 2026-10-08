// @vitest-environment happy-dom

import * as Ariakit from '@ariakit/react'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AUTH_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { installUmamiSink } from '~/utils/testing/umamiSink'
import { waitForUi } from '~/utils/testing/waitForUi'
import { LazySubscribeProModal } from '../LazySubscribeProModal'

const router = vi.hoisted(() => ({ pathname: '/yields', asPath: '/yields', query: {}, push: () => {} }))
vi.mock('next/router', () => ({ useRouter: () => router }))
// The Cloudflare widget and Google's script need their remote scripts; the test stands in for the visitor.
vi.mock('next/script', () => ({ default: () => null }))
vi.mock('~/containers/Subscription/Turnstile', () => ({
	Turnstile: function TestTurnstile({ onVerify }: { onVerify: (token: string) => void }) {
		const [complete, setComplete] = useState(false)
		return (
			<button
				type="button"
				onClick={() => {
					setComplete(true)
					onVerify('test-captcha')
				}}
			>
				{complete ? 'CAPTCHA complete' : 'Test CAPTCHA'}
			</button>
		)
	}
}))

const session = installSubscriberSession('free-reader', { account: 'free', resolved: true })
const track = installUmamiSink()
let dialog: Ariakit.DialogStore
let container: HTMLDivElement
let root: Root

function Harness() {
	dialog = Ariakit.useDialogStore()
	return (
		<session.Wrapper>
			<LazySubscribeProModal dialogStore={dialog} source="sheets" placement="toolbar" />
		</session.Wrapper>
	)
}

beforeEach(() => {
	router.asPath = '/yields'
	session.serve({ '/subscription/trial-available': { trialAvailable: true } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const openEvents = () => track.mock.calls.filter(([name]) => name === 'subscribe-modal-open')

async function setOpen(open: boolean) {
	await act(async () => dialog.setOpen(open))
	await waitForUi(() => expect(document.querySelector('[role="dialog"]') !== null).toBe(open))
}

// The sign-in fields are controlled, so a value reaches the form through an input event.
async function typeInto(input: HTMLInputElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('each open of a modal mounted closed tracks one subscribe-modal-open event', async () => {
	await act(async () => root.render(<Harness />))
	expect(openEvents()).toEqual([])

	await setOpen(true)
	await setOpen(false)
	await setOpen(true)

	expect(openEvents()).toEqual([
		['subscribe-modal-open', { page: '/yields', source: 'sheets', placement: 'toolbar' }],
		['subscribe-modal-open', { page: '/yields', source: 'sheets', placement: 'toolbar' }]
	])
})

test('a route change while the modal is open tracks no extra open', async () => {
	await act(async () => root.render(<Harness />))
	await setOpen(true)

	router.asPath = '/yields?chain=Ethereum'
	await act(async () => root.render(<Harness />))

	expect(openEvents()).toEqual([['subscribe-modal-open', { page: '/yields', source: 'sheets', placement: 'toolbar' }]])
})

test('signing in from the plan dialog returns focus to its Unlock action, not the page', async () => {
	await act(async () => pb.authStore.clear())
	session.serve({ [`${AUTH_SERVER}/auth/login`]: { token: session.token, record: session.record } })
	await act(async () => root.render(<Harness />))
	await setOpen(true)
	const button = (name: string) =>
		[...document.querySelectorAll<HTMLElement>('button, a')].find((element) => accessibleName(element) === name)!
	await act(async () => button('Already a subscriber? Sign in').focus())
	await act(async () => button('Already a subscriber? Sign in').click())
	await waitForUi(() => expect(document.querySelector('input[name="email"]')).not.toBeNull())
	await typeInto(document.querySelector<HTMLInputElement>('input[name="email"]')!, 'subscriber@example.com')
	await typeInto(document.querySelector<HTMLInputElement>('input[name="password"]')!, 'correct horse battery staple')
	await act(async () => button('Test CAPTCHA').click())
	await act(async () =>
		document
			.querySelector<HTMLInputElement>('input[name="email"]')!
			.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)

	await waitForUi(() => expect(document.activeElement).toBe(button('Unlock Pro features')))
	expect(document.querySelector('input[name="email"]')).toBeNull()
})
