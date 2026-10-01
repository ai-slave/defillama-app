// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import { FEATURES_SERVER } from '~/constants'
import type { ArticleDocument } from '~/containers/Articles/types'
import SectionArticlePage from '~/pages/research/[section]/[slug]'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { createEmptyLocalArticle } from '../document'

const router = vi.hoisted(() => ({
	isReady: true,
	pathname: '/research/[section]/[slug]',
	query: {} as Record<string, string>,
	asPath: '/research',
	replace: vi.fn(),
	push: vi.fn(),
	prefetch: vi.fn(() => Promise.resolve()),
	events: { on: vi.fn(), off: vi.fn() }
}))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))
// The site chrome is a heavy child this test asserts nothing about.
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }))

const http = installFixtureFetch()
let root: Root
let container: HTMLDivElement
let client: QueryClient

const heading = (level: number, text: string) => ({
	type: 'heading',
	attrs: { level },
	content: [{ type: 'text', text }]
})

function published(id: string, sections: Array<[string, string]>): ArticleDocument {
	return {
		...createEmptyLocalArticle('2026-07-14T00:00:00.000Z'),
		id,
		slug: id,
		title: id,
		status: 'published',
		section: 'report',
		contentJson: {
			type: 'doc',
			content: sections.flatMap(([group, child]) => [heading(2, group), heading(3, child)])
		}
	} as ArticleDocument
}

const articleA = published('article-a', [
	['Fees', 'Lending fees'],
	['Revenue', 'Token holders']
])
const articleB = published('article-b', [
	['Users', 'Daily users'],
	['Volume', 'Spot volume']
])

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	// The reader is at the top of the article, so the side panel shows the full contents rather than the compact bar.
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
		() => ({ top: 400, bottom: 400, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 }) as DOMRect
	)
	http.serve({
		[`${FEATURES_SERVER}/articles/`]: (url: URL) => ({
			article: url.pathname.endsWith('article-a') ? articleA : articleB
		}),
		[`${FEATURES_SERVER}/banners/lookup/`]: {}
	})
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
})

/** A client-side move between articles: Next keeps the page mounted and passes the new server props. */
async function show(article: ArticleDocument) {
	router.query = { section: 'report', slug: article.slug }
	router.asPath = `/research/report/${article.slug}`
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<AuthProvider>
					<SectionArticlePage initialArticle={article} initialBanners={{}} />
				</AuthProvider>
			</QueryClientProvider>
		)
	)
}

// The side panel's contents; the copy above the article body is the narrow-screen layout.
const tocLinks = () =>
	[...container.querySelectorAll('aside nav[aria-label="On this page"] a')].map((a) => a.textContent)

test('moving to another article opens its contents with every group collapsed', async () => {
	await show(articleA)
	expect(tocLinks()).toEqual(['Fees', 'Revenue'])

	await show(articleB)
	expect(tocLinks()).toEqual(['Users', 'Volume'])
})
