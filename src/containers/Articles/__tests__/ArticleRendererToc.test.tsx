// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { normalizeLocalArticleDocument } from '../document'
import { ArticleRenderer } from '../renderer/ArticleRenderer'

const http = installFixtureFetch()
let root: Root
let container: HTMLDivElement
/** Where the layout puts the top of the article: the TOC turns compact once it scrolls above 24px. */
let sentinelTop = 400

const heading = (level: number, text: string) => ({
	type: 'heading',
	attrs: { level },
	content: [{ type: 'text', text }]
})

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	sentinelTop = 400
	http.serve({ [`${FEATURES_SERVER}/banners/lookup/`]: {} })
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
		() => ({ top: sentinelTop, bottom: sentinelTop, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 }) as DOMRect
	)
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
})

async function scrollTo(top: number) {
	sentinelTop = top
	await act(async () => window.dispatchEvent(new Event('scroll')))
}

// The side panel's contents; the copy above the article body for narrow screens never turns compact.
const toc = () => container.querySelector('aside nav[aria-label="On this page"]')
const tocLinks = () => [...(toc()?.querySelectorAll('a') ?? [])].map((a) => a.textContent)

test('scrolling back above the header shows the full contents with every group collapsed again', async () => {
	const normalized = normalizeLocalArticleDocument(
		{
			title: 'Fees after the exploit',
			status: 'published',
			section: 'report',
			contentJson: {
				type: 'doc',
				content: [heading(2, 'Fees'), heading(3, 'Lending fees'), heading(2, 'Revenue'), heading(3, 'Token holders')]
			}
		},
		null,
		'2026-07-14T00:00:00.000Z'
	)
	if (!normalized.ok) throw new Error('the fixture article is invalid')
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<ArticleRenderer article={{ ...normalized.value, id: 'article' }} />
			</QueryClientProvider>
		)
	)
	expect(tocLinks()).toEqual(['Fees', 'Revenue'])

	const feesGroup = [...toc()!.querySelectorAll('button')].find((button) => button.textContent === 'Fees')!
	await act(async () => feesGroup.click())
	expect(tocLinks()).toEqual(['Fees', 'Lending fees', 'Revenue'])

	await scrollTo(0)
	await waitForUi(() => expect(toc()).toBeNull())
	await scrollTo(400)
	await waitForUi(() => expect(toc()).not.toBeNull())
	expect(tocLinks()).toEqual(['Fees', 'Revenue'])
})
