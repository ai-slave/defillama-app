// @vitest-environment happy-dom

import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { installUmamiSink } from '~/utils/testing/umamiSink'
import { waitForUi } from '~/utils/testing/waitForUi'
import { SubscribeProModal } from '../SubscribeProCard'

const router = vi.hoisted(() => ({ pathname: '/yields', asPath: '/yields', query: {}, push: () => {} }))
vi.mock('next/router', () => ({ useRouter: () => router }))

const session = installSubscriberSession('free-reader', { account: 'free', resolved: true })
const track = installUmamiSink()
let dialog: Ariakit.DialogStore
let container: HTMLDivElement
let root: Root

function Harness() {
	dialog = Ariakit.useDialogStore()
	return (
		<session.Wrapper>
			<SubscribeProModal dialogStore={dialog} source="sheets" placement="toolbar" />
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
