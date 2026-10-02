// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { TelegramStatus } from '~/containers/LlamaAI/api/telegram'
import { IntegrationRow } from '~/containers/LlamaAI/components/IntegrationRow'
import { getTelegramStatusQueryKey } from '~/containers/LlamaAI/hooks/useIntegrationLink'
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
	vi.restoreAllMocks()
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

const TELEGRAM = 'https://ai.llama.fi/telegram'
const unlinked: TelegramStatus = { link: { state: 'unlinked' }, pending: null }
async function press(element: HTMLElement) {
	await act(async () => {
		element.focus()
		element.click()
	})
}
async function renderRow(props: { initialStatus: TelegramStatus; initialTgloginToken?: string }) {
	session.client.setQueryData(getTelegramStatusQueryKey('reader'), props.initialStatus)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<IntegrationRow kind="telegram" title="Telegram" description="Chat in Telegram." {...props} />
			</session.Wrapper>
		)
	)
}

test('a confirmed disconnect hands focus to Connect', async () => {
	session.serve({ [TELEGRAM_LINK]: () => Response.json({ unlinked: true }) })
	await press(button('Disconnect')!)
	await waitForUi(() => expect(confirmation()).not.toBeNull())
	await press(button('Disconnect', confirmation()!)!)
	await waitForUi(() => expect(confirmation()).toBeNull())
	await waitForUi(() => expect(document.activeElement).toBe(button('Connect')))
})

test('Connect hands focus to the Telegram link that replaces it', async () => {
	vi.spyOn(window, 'open').mockReturnValue(null)
	session.serve({
		[`${TELEGRAM}/status`]: unlinked,
		[`${TELEGRAM}/link/start`]: {
			state: 'pending',
			token: 'token',
			deepLink: 'https://t.me/llama_bot?start=token',
			expiresAt: '2100-01-01T00:00:00.000Z'
		}
	})
	await renderRow({ initialStatus: unlinked })
	await press(button('Connect')!)
	await waitForUi(() => expect(document.activeElement?.textContent).toBe('DM /start to the bot'))
})

test('the code and switch prompts hand focus to the control of the step that replaces them', async () => {
	const confirms: Array<Response> = [
		Response.json({
			status: 'requires_switch_confirmation',
			currentTelegramUsername: 'oldllama',
			expiresAt: '2100-01-01'
		})
	]
	session.serve({ [`${TELEGRAM}/status`]: unlinked, [`${TELEGRAM}/link/confirm`]: () => confirms.shift()! })
	await renderRow({ initialStatus: unlinked, initialTgloginToken: 'token' })
	const code = document.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(code, '123456')
		code.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await press(button('Confirm')!)
	await waitForUi(() => expect(document.activeElement).toBe(button('Yes, switch')))
	// Without a parent to consume the login token, cancelling the switch returns to its code prompt.
	await press(button('Cancel')!)
	await waitForUi(() =>
		expect(document.activeElement).toBe(document.querySelector('input[autocomplete="one-time-code"]'))
	)
})
