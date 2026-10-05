// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { ArticleClient } from '../../types'
import { ArticleClientField } from '../ArticleClientField'

vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
const session = installSubscriberSession('editor-1')

const CLIENT_URL = `${FEATURES_SERVER}/research/articles/a1/client`
const sponsor = (id: string, displayName: string) => ({
	id,
	displayName,
	entityType: 'chain',
	entitySlug: id,
	createdAt: '',
	updatedAt: '',
	reports: []
})

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	session.client.setDefaultOptions({ queries: { retry: false } })
	session.serve({
		[`${FEATURES_SERVER}/research/sponsors`]: { sponsors: [sponsor('s1', 'Starknet'), sponsor('s2', 'Aave')] },
		[CLIENT_URL]: (_url: URL, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body)) as { sponsorId: string | null; relation: string | null }
			if (!body.sponsorId) return { client: null }
			const displayName = body.sponsorId === 's1' ? 'Starknet' : 'Aave'
			return { client: { id: body.sponsorId, displayName, relation: body.relation } }
		}
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function Harness({ initial }: { initial: ArticleClient | null }) {
	const [client, setClient] = useState(initial)
	return <ArticleClientField articleId="a1" client={client} onSaved={setClient} />
}

async function render(initial: ArticleClient | null) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Harness initial={initial} />
			</session.Wrapper>
		)
	)
}

const trigger = () => container.querySelector<HTMLButtonElement>('[aria-label="Article client"]')!
const radio = (name: string) =>
	[...container.querySelectorAll('label')].find((label) => label.textContent === name)!.querySelector('input')!
const clientPuts = () =>
	session.requests
		.filter((request) => request.url.href === CLIENT_URL && request.init?.method === 'PUT')
		.map((request) => JSON.parse(String(request.init?.body)))

async function pickClient(name: string) {
	await act(async () => trigger().click())
	const option = await waitForUi(() => {
		const match = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((o) => o.textContent === name)
		expect(match).toBeDefined()
		return match!
	})
	await act(async () => option.click())
}

test('picking a client, its relation, and No client each save right away and show the saved client', async () => {
	await render(null)
	expect(trigger().textContent).toBe('No client')
	expect(radio('Sponsored').disabled).toBe(true)

	await pickClient('Starknet')
	await waitForUi(() => expect(trigger().textContent).toBe('Starknet'))

	await act(async () => radio('Sponsored').click())
	await waitForUi(() => expect(radio('Sponsored').checked).toBe(true))

	await pickClient('No client')
	await waitForUi(() => expect(trigger().textContent).toBe('No client'))

	expect(clientPuts()).toEqual([
		{ sponsorId: 's1', relation: null },
		{ sponsorId: 's1', relation: 'sponsored' },
		{ sponsorId: null, relation: null }
	])
})

test('switching to another client keeps the chosen relation', async () => {
	await render({ id: 's1', displayName: 'Starknet', relation: 'collaboration' })

	await pickClient('Aave')
	await waitForUi(() => expect(trigger().textContent).toBe('Aave'))

	expect(clientPuts()).toEqual([{ sponsorId: 's2', relation: 'collaboration' }])
	expect(radio('Collaboration').checked).toBe(true)
})

test('a rejected save shows the reason in the field and keeps the saved client', async () => {
	session.serve({ [CLIENT_URL]: fixtureStatus(404, { error: 'Sponsor not found' }) })
	await render({ id: 's1', displayName: 'Starknet', relation: null })

	await pickClient('Aave')
	await waitForUi(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe('Sponsor not found'))
	expect(trigger().textContent).toBe('Starknet')
})
