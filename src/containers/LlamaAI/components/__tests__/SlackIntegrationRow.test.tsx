// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { SlackLink } from '~/containers/LlamaAI/api/slack'
import { SlackIntegrationRow } from '~/containers/LlamaAI/components/SlackIntegrationRow'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const session = installSubscriberSession('reader')
const workspace: SlackLink = {
	team_id: 'T1',
	team_name: 'Llama Research',
	default_channel_id: 'C1',
	default_channel_name: 'alerts',
	installed_at: '2026-09-01T00:00:00.000Z',
	revoked: false,
	last_error: null
}

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	session.client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const button = (name: string, within: ParentNode = document) =>
	[...within.querySelectorAll<HTMLButtonElement>('button')].find((node) => accessibleName(node) === name)
const confirmation = () => document.querySelector<HTMLElement>('[role="alertdialog"]')

test('disconnecting a workspace asks first, shows its progress in the confirmation, and closes once removed', async () => {
	const unlink = Promise.withResolvers<Response>()
	session.serve({
		'https://ai.llama.fi/slack/status': { links: [workspace], pending: null },
		'https://ai.llama.fi/slack/links/T1': () => unlink.promise
	})
	await act(async () =>
		root.render(
			<session.Wrapper>
				<SlackIntegrationRow title="Slack" description="Alerts in Slack." />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(document.body.textContent).toContain('Llama Research'))

	await act(async () => button('Disconnect')!.click())
	await waitForUi(() =>
		expect(confirmation()?.textContent).toContain('Llama Research will stop receiving LlamaAI alerts.')
	)
	await act(async () => button('Disconnect', confirmation()!)!.click())
	await waitForUi(() => expect(button('Disconnecting…', confirmation()!)).toBeDefined())

	await act(async () => unlink.resolve(Response.json({ unlinked: true })))
	await waitForUi(() => expect(confirmation()).toBeNull())
	expect(document.body.textContent).not.toContain('Llama Research')
})

test('a refused disconnect keeps the workspace and says so in the confirmation, and reopening starts clean', async () => {
	session.serve({
		'https://ai.llama.fi/slack/status': { links: [workspace], pending: null },
		'https://ai.llama.fi/slack/links/T1': () => new Response(null, { status: 500 })
	})
	await act(async () =>
		root.render(
			<session.Wrapper>
				<SlackIntegrationRow title="Slack" description="Alerts in Slack." />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(document.body.textContent).toContain('Llama Research'))

	await act(async () => button('Disconnect')!.click())
	await waitForUi(() => expect(confirmation()).not.toBeNull())
	await act(async () => button('Disconnect', confirmation()!)!.click())
	await waitForUi(() => expect(confirmation()?.textContent).toContain("Couldn't disconnect this workspace. Try again."))

	await act(async () => button('Cancel', confirmation()!)!.click())
	await waitForUi(() => expect(confirmation()).toBeNull())
	await act(async () => button('Disconnect')!.click())
	await waitForUi(() => expect(confirmation()).not.toBeNull())
	expect(confirmation()!.textContent).not.toContain("Couldn't disconnect")
	expect(document.body.textContent).toContain('Llama Research')
})
