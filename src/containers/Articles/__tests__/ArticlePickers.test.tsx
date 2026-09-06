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

	function chips() {
		return Array.from(container.querySelectorAll('span.truncate'), (el) => el.textContent)
	}

	test('multi picker keeps a resolved title when another selection is removed and the new lookup fails', async () => {
		listArticles.mockResolvedValueOnce({ items: [alpha, beta], nextCursor: null })
		await render(<ArticleMultiPicker value={['article-a', 'article-b']} onChange={vi.fn()} />)
		await flush()
		expect(chips()).toEqual(['Alpha report', 'Beta report'])

		listArticles.mockRejectedValue(new Error('offline'))
		await render(<ArticleMultiPicker value={['article-a']} onChange={vi.fn()} />)
		await flush()
		expect(chips()).toEqual(['Alpha report'])
	})

	test('multi picker adopts a fresh title when a later lookup succeeds', async () => {
		listArticles.mockResolvedValueOnce({ items: [alpha], nextCursor: null })
		await render(<ArticleMultiPicker value={['article-a']} onChange={vi.fn()} />)
		await flush()
		expect(chips()).toEqual(['Alpha report'])

		listArticles.mockResolvedValueOnce({ items: [article('article-a', 'Alpha report v2'), beta], nextCursor: null })
		await render(<ArticleMultiPicker value={['article-a', 'article-b']} onChange={vi.fn()} />)
		await flush()
		expect(chips()).toEqual(['Alpha report v2', 'Beta report'])
	})

	function selectedLabel() {
		return container.querySelector('input')?.getAttribute('placeholder')
	}

	test('single picker keeps the selected title when its search results move on', async () => {
		listArticles.mockResolvedValueOnce({ items: [alpha], nextCursor: null })
		await render(<ArticlePicker value="article-a" onChange={vi.fn()} />)
		await flush()
		expect(selectedLabel()).toBe('Alpha report')

		await render(<ArticlePicker value="article-a" onChange={vi.fn()} listArticlesParams={{ limit: 5 }} />)
		await flush()
		expect(selectedLabel()).toBe('Alpha report')
		expect(listArticles).toHaveBeenCalledTimes(1)
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
