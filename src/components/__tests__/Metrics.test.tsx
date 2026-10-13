// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TOTAL_TRACKED_BY_METRIC_API } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { Metrics, MetricsAndTools } from '../Metrics'

const router = vi.hoisted(() => ({ pathname: '/', asPath: '/', query: {}, push: () => {} }))
vi.mock('next/router', () => ({ useRouter: () => router }))

const http = installFixtureFetch()
// Categories each scrollIntoView call targeted, in order; jsdom-style environments cannot scroll.
let scrolledCategories: Array<string | null>
let container: HTMLDivElement
let root: Root

beforeEach(() => {
	http.serve({ [TOTAL_TRACKED_BY_METRIC_API]: {} })
	scrolledCategories = []
	vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element) {
		scrolledCategories.push(this.getAttribute('data-category'))
	})
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
})

async function render(ui: ReactNode) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	await act(async () => root.render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>))
	// Let any frame callbacks scheduled on mount run before the test acts.
	await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
}

const searchInput = () => document.querySelector<HTMLInputElement>('input[placeholder^="Search"]')!
const browseButton = () =>
	[...document.querySelectorAll('button')].find((button) => button.textContent === 'Click to browse & search')!
const closeButton = () => document.querySelector<HTMLButtonElement>('button[aria-label="Close dialog"]')!

async function openDialog() {
	await act(async () => browseButton().click())
	await waitForUi(() => expect(document.querySelector('[role="dialog"]:not([hidden])')).not.toBeNull())
}

async function closeDialog() {
	await act(async () => closeButton().click())
	await waitForUi(() => expect(document.querySelector('[role="dialog"]:not([hidden])')).toBeNull())
}

test('opening the metrics dialog on a metric page scrolls to that metric category', async () => {
	router.pathname = '/oracles'
	await render(<MetricsAndTools currentMetric={['Total Value Locked']} />)
	scrolledCategories = []

	await openDialog()

	await waitForUi(() => expect(scrolledCategories).toContain('Total Value Locked'))
})

test('reopening the metrics dialog on a metric page keeps the scroll position the reader left', async () => {
	router.pathname = '/oracles'
	await render(<MetricsAndTools currentMetric={['Total Value Locked']} />)
	await openDialog()
	await closeDialog()
	scrolledCategories = []

	await openDialog()

	expect(scrolledCategories).not.toContain('Total Value Locked')
})

test('opening the metrics dialog on a metric page leaves focus off the search input', async () => {
	router.pathname = '/oracles'
	await render(<MetricsAndTools currentMetric={['Total Value Locked']} />)

	await openDialog()

	await waitForUi(() => expect(document.querySelector('[role="dialog"]')!.contains(document.activeElement)).toBe(true))
	expect(document.activeElement).not.toBe(searchInput())
})

test('opening the metrics dialog on a page without a metric category focuses the search input', async () => {
	router.pathname = '/'
	await render(<MetricsAndTools currentMetric={['Overview']} />)

	await openDialog()

	await waitForUi(() => expect(document.activeElement).toBe(searchInput()))
})

test('the metrics page leaves focus off the search input on load', async () => {
	router.pathname = '/metrics'
	await render(<Metrics />)

	expect(document.activeElement).toBe(document.body)
})
