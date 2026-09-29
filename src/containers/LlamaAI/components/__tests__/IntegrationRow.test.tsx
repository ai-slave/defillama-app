// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { TelegramStatus } from '~/containers/LlamaAI/api/telegram'
import { IntegrationRow } from '~/containers/LlamaAI/components/IntegrationRow'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const session = installSubscriberSession('reader')
const TELEGRAM_LINK = 'https://ai.llama.fi/telegram/link'
const linked: TelegramStatus = {
	link: { state: 'linked', telegramUsername: 'llamafan', linkedAt: '2026-09-01T00:00:00.000Z' },
	pending: null
}

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	session.client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<IntegrationRow kind="telegram" title="Telegram" description="Chat in Telegram." initialStatus={linked} />
			</session.Wrapper>
		)
	)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const button = (name: string, within: ParentNode = document) =>
	[...within.querySelectorAll<HTMLButtonElement>('button')].find((node) => accessibleName(node) === name)
const confirmation = () => document.querySelector<HTMLElement>('[role="alertdialog"]')
const unlinkRequests = () =>
	session.requests.filter((request) => request.url.href === TELEGRAM_LINK && request.init?.method === 'DELETE').length

test('Disconnect asks first, keeps its progress and error in the confirmation, and closes once unlinked', async () => {
	const firstUnlink = Promise.withResolvers<Response>()
	const retriedUnlink = Promise.withResolvers<Response>()
	let unlinks = 0
	session.serve({ [TELEGRAM_LINK]: () => (++unlinks === 1 ? firstUnlink.promise : retriedUnlink.promise) })

	await act(async () => button('Disconnect')!.click())
	await waitForUi(() => expect(confirmation()?.textContent).toContain('LlamaAI stops chatting with @llamafan'))
	expect(unlinkRequests()).toBe(0)

	await act(async () => button('Disconnect', confirmation()!)!.click())
	await waitForUi(() => expect(button('Disconnecting…', confirmation()!)).toBeDefined())
	await act(async () => firstUnlink.resolve(new Response('offline', { status: 503 })))
	await waitForUi(() =>
		expect(confirmation()!.querySelector('[role="alert"]')?.textContent).toBe(
			"Couldn't disconnect Telegram. Try again."
		)
	)

	await act(async () => button('Disconnect', confirmation()!)!.click())
	await waitForUi(() => expect(button('Disconnecting…', confirmation()!)).toBeDefined())
	await act(async () => retriedUnlink.resolve(Response.json({ unlinked: true })))
	await waitForUi(() => expect(confirmation()).toBeNull())
	expect(button('Connect')).toBeDefined()
	expect(unlinkRequests()).toBe(2)
})
