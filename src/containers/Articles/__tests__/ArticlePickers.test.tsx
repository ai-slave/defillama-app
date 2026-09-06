// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ArticleMultiPicker } from '../admin/ArticleMultiPicker'
import { ArticlePicker } from '../admin/ArticlePicker'
import type { ArticleDocument } from '../types'

const listArticles = vi.fn()

vi.mock('~/auth', () => ({
	useAuthContext: () => ({ authorizedFetch: vi.fn() })
}))

vi.mock('~/containers/Articles/api', () => ({
	listArticles: (...args: Array<unknown>) => listArticles(...args)
}))

function article(id: string, title: string) {
	return { id, title, slug: id, section: null } as unknown as ArticleDocument
}

const alpha = article('article-a', 'Alpha report')
const beta = article('article-b', 'Beta report')

async function flush() {
	// Lets React Query settle a resolved or rejected fetch and React commit the result.
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}

describe('article pickers keep known titles', () => {
	let container: HTMLDivElement
	let root: Root
	let queryClient: QueryClient

	function render(element: ReactElement) {
		return act(async () => {
			root.render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>)
		})
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		listArticles.mockReset()
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		queryClient.clear()
	})

	test('multi picker keeps a resolved title when another selection is removed and the new lookup fails', async () => {
		listArticles.mockResolvedValueOnce({ items: [alpha, beta], nextCursor: null })
		await render(<ArticleMultiPicker value={['article-a', 'article-b']} onChange={vi.fn()} />)
		await flush()
		expect(container.textContent).toContain('Alpha report')
		expect(container.textContent).toContain('Beta report')

		listArticles.mockRejectedValue(new Error('offline'))
		await render(<ArticleMultiPicker value={['article-a']} onChange={vi.fn()} />)
		await flush()
		expect(container.textContent).toContain('Alpha report')
		expect(container.textContent).not.toContain('Beta report')
	})

	test('multi picker adopts a fresh title when a later lookup succeeds', async () => {
		listArticles.mockResolvedValueOnce({ items: [alpha], nextCursor: null })
		await render(<ArticleMultiPicker value={['article-a']} onChange={vi.fn()} />)
		await flush()
		expect(container.textContent).toContain('Alpha report')
		expect(container.textContent).not.toContain('Beta report')

		listArticles.mockResolvedValueOnce({ items: [article('article-a', 'Alpha report v2'), beta], nextCursor: null })
		await render(<ArticleMultiPicker value={['article-a', 'article-b']} onChange={vi.fn()} />)
		await flush()
		expect(container.textContent).toContain('Alpha report v2')
		expect(container.textContent).toContain('Beta report')
	})

	function selectedLabel() {
		return container.querySelector('[role="combobox"]')?.getAttribute('placeholder')
	}

	test('single picker keeps the selected title when its search results move on', async () => {
		listArticles.mockImplementation(async ({ query }) => ({
			items: query === 'Beta' ? [beta] : [alpha],
			nextCursor: null
		}))
		await render(<ArticlePicker value="article-a" onChange={vi.fn()} />)
		await flush()
		expect(selectedLabel()).toBe('Alpha report')

		const input = container.querySelector<HTMLInputElement>('[role="combobox"]')!
		const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
		await act(async () => {
			input.focus()
			setValue.call(input, 'Beta')
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
		await vi.waitFor(async () => {
			await flush()
			// The popover renders in a portal outside the component container.
			const options = Array.from(document.querySelectorAll('[role="option"]'), (el) => el.textContent)
			expect(options).toHaveLength(1)
			expect(options[0]).toContain('Beta report')
			expect(options[0]).not.toContain('Alpha report')
		})
		expect(selectedLabel()).toBe('Alpha report')
	})

	test('single picker never shows another article title when the new selection fails to resolve', async () => {
		listArticles.mockResolvedValueOnce({ items: [alpha], nextCursor: null })
		await render(<ArticlePicker value="article-a" onChange={vi.fn()} />)
		await flush()
		expect(selectedLabel()).toBe('Alpha report')

		listArticles.mockRejectedValue(new Error('offline'))
		await render(<ArticlePicker value="article-b" onChange={vi.fn()} />)
		await flush()
		expect(selectedLabel()).toBe('Search articles by title…')

		await render(<ArticlePicker value="article-a" onChange={vi.fn()} />)
		expect(selectedLabel()).toBe('Alpha report')
	})
})
