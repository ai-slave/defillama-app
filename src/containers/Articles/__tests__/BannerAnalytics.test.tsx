// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ArticleBannerStrip } from '../renderer/ArticleBannerStrip'
import { ArticleImageBanner } from '../renderer/ArticleImageBanner'
import { ArticleImageBannerHorizontal } from '../renderer/ArticleImageBannerHorizontal'
import { ArticlePromoCard } from '../renderer/ArticlePromoBanner'
import type { Banner, BannerLookupResult } from '../types'

const mocks = vi.hoisted(() => ({
	trackUmamiEvent: vi.fn(),
	lookups: new Map<string, BannerLookupResult>()
}))

vi.mock('~/utils/analytics/umami', () => ({
	trackUmamiEvent: mocks.trackUmamiEvent
}))

vi.mock('@tanstack/react-query', () => ({
	useQuery: vi.fn(({ queryKey, enabled = true }: { queryKey: Array<unknown>; enabled?: boolean }) => ({
		data: enabled ? mocks.lookups.get(JSON.stringify(queryKey)) : undefined,
		isLoading: false
	}))
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		authorizedFetch: vi.fn(),
		isAuthenticated: true,
		loaders: { userLoading: false }
	})
}))

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

const key = (...parts: Array<string>) => JSON.stringify(['research', 'banner', ...parts])

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
		mocks.trackUmamiEvent.mockReset()
		mocks.lookups.clear()
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
		await act(async () => root.render(element))
	}

	async function enterViewport() {
		await act(async () => {
			for (const observer of FakeIntersectionObserver.instances) observer.intersect()
		})
	}

	async function clickLink() {
		const link = container.querySelector('a')
		expect(link).not.toBeNull()
		await act(async () => link!.click())
	}

	async function expectImpressionOnceAndClick(widgetLabel: string) {
		expect(mocks.trackUmamiEvent).not.toHaveBeenCalled()

		await enterViewport()
		await enterViewport()
		expect(mocks.trackUmamiEvent).toHaveBeenCalledOnce()
		expect(mocks.trackUmamiEvent).toHaveBeenCalledWith(...expectedPayload('widget_impression', widgetLabel))

		await clickLink()
		expect(mocks.trackUmamiEvent).toHaveBeenCalledTimes(2)
		expect(mocks.trackUmamiEvent).toHaveBeenLastCalledWith(...expectedPayload('widget_click', widgetLabel))
	}

	test('reports the sidebar image banner as an impression once and a click', async () => {
		mocks.lookups.set(key('article', 'article-id'), emptyLookup())
		mocks.lookups.set(key('section', 'report'), emptyLookup())
		mocks.lookups.set(key('all-articles'), {
			...emptyLookup(),
			image: banner({ type: 'image', imageUrl: '/uploads/image/global' })
		})

		await render(<ArticleImageBanner articleId="article-id" section="report" />)
		await expectImpressionOnceAndClick('DefiLlama Research article image banner')
	})

	test('reports the in-body image banner under the same label as the sidebar one', async () => {
		mocks.lookups.set(key('article', 'article-id'), emptyLookup())
		mocks.lookups.set(key('section', 'report'), emptyLookup())
		mocks.lookups.set(key('all-articles'), {
			...emptyLookup(),
			imageHorizontal: banner({ type: 'image-horizontal', imageUrl: '/uploads/image/horizontal' })
		})

		await render(<ArticleImageBannerHorizontal articleId="article-id" section="report" />)
		await expectImpressionOnceAndClick('DefiLlama Research article image banner')
	})

	test('reports the promo frame as an impression once and a click', async () => {
		mocks.lookups.set(key('all-articles'), {
			...emptyLookup(),
			promo: banner({ type: 'promo', imageCardUrl: '/uploads/promo/card' })
		})

		await render(<ArticlePromoCard articleId="article-id" />)
		await expectImpressionOnceAndClick('DefiLlama Research article promo banner')
	})

	test('reports top bar clicks with a label per scope and never an impression', async () => {
		mocks.lookups.set(key('landing'), { ...emptyLookup(), text: banner({ text: 'Landing strip' }) })
		await render(<ArticleBannerStrip scope="landing" />)
		await enterViewport()
		await clickLink()
		expect(mocks.trackUmamiEvent).toHaveBeenCalledOnce()
		expect(mocks.trackUmamiEvent).toHaveBeenCalledWith(
			...expectedPayload('widget_click', 'DefiLlama Research landing top bar')
		)

		mocks.trackUmamiEvent.mockReset()
		mocks.lookups.set(key('article', 'article-id'), { ...emptyLookup(), text: banner({ text: 'Article strip' }) })
		mocks.lookups.set(key('section', 'report'), emptyLookup())
		mocks.lookups.set(key('all-articles'), emptyLookup())
		await render(<ArticleBannerStrip scope="article" articleId="article-id" section="report" />)
		await clickLink()
		expect(mocks.trackUmamiEvent).toHaveBeenCalledOnce()
		expect(mocks.trackUmamiEvent).toHaveBeenCalledWith(
			...expectedPayload('widget_click', 'DefiLlama Research article top bar')
		)
	})

	test('does not track clicks on the section top bar', async () => {
		mocks.lookups.set(key('section', 'report'), { ...emptyLookup(), text: banner({ text: 'Section strip' }) })
		await render(<ArticleBannerStrip scope="section" section="report" />)
		await clickLink()
		expect(mocks.trackUmamiEvent).not.toHaveBeenCalled()
	})
})
