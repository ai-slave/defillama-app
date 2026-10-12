// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ResearchSponsorsAdminView } from '../ResearchSponsorsAdminView'

vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
const session = installSubscriberSession('editor-1')
const SPONSORS_URL = `${FEATURES_SERVER}/research/sponsors`

let sponsors: Array<Record<string, unknown>>
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	sponsors = []
	session.client.setDefaultOptions({ queries: { retry: false } })
	session.serve({
		[SPONSORS_URL]: (_url: URL, init?: RequestInit) => {
			if (init?.method !== 'POST') return { sponsors }
			const body = JSON.parse(String(init.body))
			const sponsor = {
				id: 'forgd',
				displayName: body.displayName,
				entityType: null,
				entitySlug: null,
				websiteUrl: body.websiteUrl,
				createdAt: '',
				updatedAt: '',
				reports: []
			}
			sponsors = [sponsor]
			return { sponsor }
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

const field = (label: string) =>
	[...container.querySelectorAll('label')]
		.find((node) => node.textContent === label)!
		.closest('div')!
		.querySelector('input')!

async function type(input: HTMLInputElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

const submit = () =>
	act(async () => [...container.querySelectorAll('button')].find((b) => b.textContent === 'Add')!.click())

test('a company without a DefiLlama page is added by name and website and listed with its website', async () => {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<ResearchSponsorsAdminView />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(container.textContent).toContain('No companies yet'))

	const websiteMode = [...container.querySelectorAll('label')].find((l) => l.textContent === 'Name and website')!
	await act(async () => websiteMode.querySelector('input')!.click())

	await submit()
	expect(container.textContent).toContain('Enter the name.')
	expect(container.textContent).toContain('Enter the website.')

	await type(field('Name'), 'Forgd')
	await type(field('Website'), 'forgd.com')
	await submit()
	expect(container.textContent).toContain('Enter a valid URL starting with http:// or https://.')

	await type(field('Website'), 'https://forgd.com')
	await submit()
	await waitForUi(() =>
		expect(container.querySelector('a[href="https://forgd.com"]')?.textContent).toBe('https://forgd.com')
	)

	const posts = session.requests.filter((r) => r.url.href === SPONSORS_URL && r.init?.method === 'POST')
	expect(posts.map((r) => JSON.parse(String(r.init?.body)))).toEqual([
		{ displayName: 'Forgd', websiteUrl: 'https://forgd.com' }
	])
})
