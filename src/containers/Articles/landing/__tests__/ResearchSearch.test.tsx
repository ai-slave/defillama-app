// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import ResearchSearch from '../ResearchSearch'

const router = vi.hoisted(() => ({
	pathname: '/research',
	query: {} as Record<string, string>,
	isReady: true,
	push: vi.fn(),
	replace: vi.fn()
}))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))
const http = installFixtureFetch()

let root: Root
let container: HTMLDivElement
let client: QueryClient

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	router.query = { q: 'aave' }
	router.push.mockReset()
	http.serve({ [`${FEATURES_SERVER}/articles`]: { items: [], totalItems: 0, totalPages: 1 } })
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function render() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<ResearchSearch />
			</QueryClientProvider>
		)
	)
}

/** Next re-renders the page with the query of the URL it moved to. */
async function navigate(href: string) {
	router.query = Object.fromEntries(new URL(href, 'https://defillama.com').searchParams)
	await render()
}

const input = () => container.querySelector<HTMLInputElement>('input[name="q"]')!

async function type(value: string) {
	await act(async () => {
		input().focus()
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value)
		input().dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('the search box follows the URL query, even while focused, and submits what the reader typed', async () => {
	await render()
	expect(input().value).toBe('aave')

	// Back to another search while the box has focus and an unsent draft.
	await type('aave fees')
	await navigate('/research?q=compound')
	expect(document.activeElement).toBe(input())
	expect(input().value).toBe('compound')

	// Forward again: the discarded draft stays discarded.
	await navigate('/research?q=aave')
	expect(input().value).toBe('aave')

	await type('  maker  ')
	await act(async () => input().form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
	expect(router.push).toHaveBeenCalledWith('/research?q=maker', undefined, { shallow: false, scroll: false })
	await navigate(router.push.mock.calls[0][0])
	expect(input().value).toBe('maker')
	expect(document.activeElement).toBe(input())
})
