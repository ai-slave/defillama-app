// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { TopAuthorEntry } from '~/containers/Authors/types'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { TopAuthorsRail } from '../TopAuthorsRail'

const http = installFixtureFetch()

const entry: TopAuthorEntry = {
	author: {
		slug: 'llama',
		displayName: 'Llama Analyst',
		bio: 'Charts every day',
		avatarUrl: null,
		socials: {},
		createdAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-01-01T00:00:00Z'
	},
	dashboardCount: 12,
	totalViews: 15_400,
	totalLikes: 2300,
	followerCount: 42
} as TopAuthorEntry

let container: HTMLDivElement
let root: Root
let client: QueryClient

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})

async function render() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<TopAuthorsRail />
			</QueryClientProvider>
		)
	)
}

test('the rail keeps its heading while loading and says so when there are no authors', async () => {
	const response = Promise.withResolvers<Response>()
	http.serve({ '/authors/top': () => response.promise })
	await render()
	expect(container.querySelector('h3')?.textContent).toBe('Top Authors')
	expect(container.textContent).not.toContain('No authors to show yet')

	await act(async () => response.resolve(Response.json({ items: [] })))
	await waitForUi(() => expect(container.textContent).toContain('No authors to show yet'))
	expect(container.querySelector('h3')?.textContent).toBe('Top Authors')
})

test('author cards carry their handle and compact counts', async () => {
	http.serve({ '/authors/top': { items: [entry] } })
	await render()
	await waitForUi(() => expect(container.textContent).toContain('@llama'))
	expect(container.textContent).toContain('12 dashboards')
	expect(container.textContent).toContain('15.4K views')
	expect(container.textContent).toContain('2.3K likes')
})
