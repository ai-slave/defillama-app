// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installUmamiSink } from '~/utils/testing/umamiSink'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ArticleBannerStrip } from '../renderer/ArticleBannerStrip'
import { ArticleImageBanner } from '../renderer/ArticleImageBanner'
import { ArticleImageBannerHorizontal } from '../renderer/ArticleImageBannerHorizontal'
import { ArticlePromoCard } from '../renderer/ArticlePromoBanner'
import type { Banner, BannerLookupResult } from '../types'

const http = installFixtureFetch()
const track = installUmamiSink()

/** Lets a test decide when the observed sentinel enters the viewport. */
class FakeIntersectionObserver {
	static instances: Array<FakeIntersectionObserver> = []
	private targets = new Set<Element>()

	constructor(private readonly callback: IntersectionObserverCallback) {
		FakeIntersectionObserver.instances.push(this)
	}

	observe(target: Element) {
		this.targets.add(target)
	}

	unobserve(target: Element) {
		this.targets.delete(target)
	}

	disconnect() {
		this.targets.clear()
	}

	takeRecords(): Array<IntersectionObserverEntry> {
		return []
	}

	intersect() {
		if (this.targets.size === 0) return
		const entries = [...this.targets].map((target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry)
		this.callback(entries, this as unknown as IntersectionObserver)
	}
}

const emptyLookup = (): BannerLookupResult => ({
	text: null,
	image: null,
	imageHorizontal: null,
	promo: null,
	imageSquare: null
})

const banner = (overrides: Partial<Banner>): Banner => ({
	id: 'banner-id',
	type: 'text',
	scope: 'all_articles',
	section: null,
	articleId: null,
	text: null,
	linkUrl: 'https://example.com/sponsor',
	linkLabel: null,
	imageUrl: null,
	imageAlt: null,
	imageWideUrl: null,
	imageCardUrl: null,
	imageMobileUrl: null,
	imageLandingMobileUrl: null,
	disclosureText: null,
	disclosureUrl: null,
	landingLinkUrl: null,
	articleLinkUrl: null,
	showOnLanding: true,
	excludedArticleIds: [],
	targetCountries: [],
	enabled: true,
	createdByPbUserId: 'user-id',
	createdAt: '2026-05-14T00:00:00.000Z',
	updatedAt: '2026-05-14T00:00:00.000Z',
	...overrides
})

// Serves banner lookups by path, e.g. serve({ 'all-articles': ... }); every other lookup is empty.
function serve(lookups: Record<string, Partial<BannerLookupResult>>) {
	http.serve({ [`${FEATURES_SERVER}/banners/lookup/`]: emptyLookup() })
	for (const path in lookups) http.serve({ [`/banners/lookup/${path}`]: { ...emptyLookup(), ...lookups[path] } })
}

function expectedPayload(eventName: string, widgetLabel: string) {
	return [
		eventName,
		{
			page_type: 'research',
			page_widget: widgetLabel,
			triggered_on: undefined,
			article_id: '',
			article_title: '',
			author: '',
			publish_date: '',
			topics: ''
		}
	]
}

describe('article banner analytics', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		track.mockReset()
		FakeIntersectionObserver.instances = []
		vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
		// Keep happy-dom from navigating away when a banner link is clicked.
		window.addEventListener('click', (event) => event.preventDefault(), true)
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	})

	async function render(element: React.ReactElement) {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		await act(async () => root.render(<QueryClientProvider client={client}>{element}</QueryClientProvider>))
		await waitForUi(() => expect(container.querySelector('a')).not.toBeNull(), { timeout: 1000 })
	}

	async function enterViewport() {
		await act(async () => {
			for (const observer of FakeIntersectionObserver.instances) observer.intersect()
		})
	}

	async function clickLink() {
		await act(async () => container.querySelector('a')!.click())
	}

	async function expectImpressionOnceAndClick(widgetLabel: string) {
		expect(track).not.toHaveBeenCalled()

		await enterViewport()
		await enterViewport()
		expect(track).toHaveBeenCalledOnce()
		expect(track).toHaveBeenCalledWith(...expectedPayload('widget_impression', widgetLabel))

		await clickLink()
		expect(track).toHaveBeenCalledTimes(2)
		expect(track).toHaveBeenLastCalledWith(...expectedPayload('widget_click', widgetLabel))
	}

	test('reports the sidebar image banner as an impression once and a click', async () => {
		serve({ 'all-articles': { image: banner({ type: 'image', imageUrl: '/uploads/image/global' }) } })

		await render(<ArticleImageBanner articleId="article-id" section="report" />)
		await expectImpressionOnceAndClick('DefiLlama Research article image banner')
	})

	test('reports the in-body image banner under the same label as the sidebar one', async () => {
		serve({
			'all-articles': { imageHorizontal: banner({ type: 'image-horizontal', imageUrl: '/uploads/image/horizontal' }) }
		})

		await render(<ArticleImageBannerHorizontal articleId="article-id" section="report" />)
		await expectImpressionOnceAndClick('DefiLlama Research article image banner')
	})

	test('reports the promo frame as an impression once and a click', async () => {
		serve({ 'all-articles': { promo: banner({ type: 'promo', imageCardUrl: '/uploads/promo/card' }) } })

		await render(<ArticlePromoCard articleId="article-id" />)
		await expectImpressionOnceAndClick('DefiLlama Research article promo banner')
	})

	test('reports landing and article top bar clicks with a label per scope, never section clicks or impressions', async () => {
		serve({ landing: { text: banner({ text: 'Landing strip' }) } })
		await render(<ArticleBannerStrip scope="landing" />)
		await enterViewport()
		await clickLink()
		expect(track).toHaveBeenCalledOnce()
		expect(track).toHaveBeenCalledWith(...expectedPayload('widget_click', 'DefiLlama Research landing top bar'))

		track.mockReset()
		serve({ 'article/article-id': { text: banner({ text: 'Article strip' }) } })
		await render(<ArticleBannerStrip scope="article" articleId="article-id" section="report" />)
		await clickLink()
		expect(track).toHaveBeenCalledOnce()
		expect(track).toHaveBeenCalledWith(...expectedPayload('widget_click', 'DefiLlama Research article top bar'))

		track.mockReset()
		await act(async () => root.unmount())
		root = createRoot(container)
		serve({ 'section/report': { text: banner({ text: 'Section strip' }) } })
		await render(<ArticleBannerStrip scope="section" section="report" />)
		await clickLink()
		expect(track).not.toHaveBeenCalled()
	})
})
