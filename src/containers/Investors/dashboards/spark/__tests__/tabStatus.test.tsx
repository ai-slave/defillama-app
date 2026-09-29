// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import Financials from '../Financials'
import PressReleases from '../PressReleases'

const http = installFixtureFetch()

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
	container.remove()
	client.clear()
})

async function renderTab(Tab: ComponentType) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Tab />
			</QueryClientProvider>
		)
	)
}

test('Financials says it is loading while its request is in flight', async () => {
	http.serve({ '/api/public/spark/financials': () => new Promise<Response>(() => {}) })
	await renderTab(Financials)
	expect(container.querySelector('[role="status"]')?.textContent).toMatch(/^Loading/)
})

test('Financials shows an error when its request fails, instead of an empty page', async () => {
	http.serve({ '/api/public/spark/financials': fixtureStatus(500, {}) })
	await renderTab(Financials)
	await waitForUi(() =>
		expect(container.querySelector('[role="alert"]')?.textContent).toBe("Couldn't load Spark financials.")
	)
})

test('Reports & Press Releases shows an error when its request fails, not an empty list', async () => {
	http.serve({ '/api/public/spark/reports': fixtureStatus(500, {}) })
	await renderTab(PressReleases)
	await waitForUi(() =>
		expect(container.querySelector('[role="alert"]')?.textContent).toBe(
			"Couldn't load Spark reports and press releases."
		)
	)
	expect(container.textContent).not.toContain('No reports or press releases available')
})
