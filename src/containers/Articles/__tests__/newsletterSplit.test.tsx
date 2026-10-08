// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import { ResearchSearchDialog } from '~/components/ResearchSearchDialog'
import { MobileSearch } from '~/components/Search'
import { ResearchFooter } from '~/containers/Articles/landing/ResearchFooter'
import { ResearchHero } from '~/containers/Articles/landing/ResearchHero'
import { ResearchLatest } from '~/containers/Articles/landing/ResearchLatest'
import { ResearchNewsletters } from '~/containers/Articles/landing/ResearchNewsletters'
import type { ResearchNewsletterItem } from '~/containers/Articles/newsletterFeed'
import type { ArticleDocument } from '~/containers/Articles/types'
import NewslettersPage from '~/pages/newsletters'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'

const http = installFixtureFetch()

vi.mock('next/router', () => ({
	default: { events: { on: vi.fn(), off: vi.fn() } },
	useRouter: () => ({
		pathname: '/newsletters',
		asPath: '/newsletters',
		query: {},
		events: { on: vi.fn(), off: vi.fn() }
	})
}))

function renderWithQueryClient(element: ReactElement) {
	const queryClient = new QueryClient({
		defaultOptions: {
			mutations: {
				retry: false
			},
			queries: {
				retry: false
			}
		}
	})
	return renderToStaticMarkup(
		<QueryClientProvider client={queryClient}>
			<AuthProvider>{element}</AuthProvider>
		</QueryClientProvider>
	)
}

function renderToDom(element: ReactElement) {
	const root = document.createElement('div')
	root.innerHTML = renderWithQueryClient(element)
	return root
}

describe('newsletter and media-kit split', () => {
	test('links the research footer to the internal newsletters page', () => {
		const root = renderToDom(<ResearchFooter />)

		expect(root.querySelector('a[href="/newsletters"]')?.textContent).toBe('DefiLlama newsletters')
	})

	test('starts the newsletters page with both newsletters selected and an enabled submit that names them', () => {
		const root = renderToDom(<NewslettersPage />)

		const pressed = [...root.querySelectorAll('[role="group"] button[aria-pressed]')].map((button) =>
			button.getAttribute('aria-pressed')
		)
		expect(pressed).toEqual(['true', 'true'])
		const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]')!
		expect(submit.textContent).toBe('Subscribe to both newsletters')
		expect([submit.getAttribute('aria-disabled'), submit.disabled]).toEqual([null, false])
	})

	test('a newsletters submit with no publication or email says what is missing and focuses the first card', async () => {
		const container = document.createElement('div')
		document.body.append(container)
		const root = createRoot(container)
		const queryClient = new QueryClient()
		try {
			await act(async () =>
				root.render(
					<QueryClientProvider client={queryClient}>
						<AuthProvider>
							<NewslettersPage />
						</AuthProvider>
					</QueryClientProvider>
				)
			)
			const cards = [...container.querySelectorAll<HTMLButtonElement>('[role="group"] button[aria-pressed]')]
			const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
			await act(async () => cards[0].click())
			expect(submit.textContent).toBe('Subscribe to 1 newsletter')
			await act(async () => cards[1].click())
			expect(submit.textContent).toBe('Subscribe')
			const errorTexts = () => [...container.querySelectorAll('.text-error')].map((element) => element.textContent)
			expect(errorTexts()).toEqual([])

			await act(async () => submit.click())

			expect(errorTexts()).toEqual(['Choose at least one publication.', 'Enter an email address.'])
			expect(document.activeElement).toBe(cards[0])
			const group = container.querySelector('[role="group"]')!
			expect(document.getElementById(group.getAttribute('aria-describedby')!)?.textContent).toBe(
				'Choose at least one publication.'
			)
			await act(async () => cards[1].click())
			expect(errorTexts()).toEqual(['Enter an email address.'])
			expect(http.requests.filter((request) => request.url.pathname === '/newsletter/subscribe')).toHaveLength(0)
		} finally {
			await act(async () => root.unmount())
			container.remove()
			queryClient.clear()
		}
	})

	test('links the research hero subscribe button to the newsletters page', () => {
		const root = renderToDom(<ResearchHero title="Research" subtitle="Market intelligence" reports={[]} />)

		expect(root.querySelector('[aria-label="Subscribe to DefiLlama newsletters"]')?.getAttribute('href')).toBe(
			'/newsletters'
		)
	})

	test('renders the desktop Research search trigger in the hero as a dialog button', () => {
		const root = renderToDom(<ResearchHero title="Research" subtitle="Market intelligence" reports={[]} />)

		expect(root.querySelector('[aria-label="Search DefiLlama Research and Newsletters"]')?.tagName).toBe('BUTTON')
	})

	test('provides LlamaAI navigation and Research search on mobile', () => {
		const root = renderToDom(<MobileSearch searchTrigger={<ResearchSearchDialog variant="mobile" />} />)

		expect(root.querySelector('a[href="/ai"]')).not.toBeNull()
		expect(root.querySelector('[aria-label="Search DefiLlama Research and Newsletters"]')?.tagName).toBe('BUTTON')
	})

	test('identifies the latest article as an interview', () => {
		const article = {
			id: 'latest-article',
			title: 'Latest research',
			slug: 'latest-research',
			section: 'interview',
			coverImage: {
				url: '/latest.png',
				alt: 'Latest research'
			}
		} as ArticleDocument
		const html = renderWithQueryClient(<ResearchLatest articles={[article]} />)

		expect(html).toContain('INTERVIEW')
	})

	test('renders newsletter discovery, archive and subscription links with interviews', () => {
		const newsletter = {
			id: 'newsletter-1',
			title: 'Weekly DeFi market structure',
			description: 'Research Notes',
			href: 'https://defillama-research.beehiiv.com/p/market-structure',
			imageUrl: 'https://media.beehiiv.com/market-structure.png',
			publishedAt: '2026-08-27T18:10:12.000Z'
		} satisfies ResearchNewsletterItem
		const interview = {
			id: 'interview-1',
			title: 'Protocol founder interview',
			slug: 'protocol-founder',
			section: 'interview',
			coverImage: null
		} as ArticleDocument

		const html = renderWithQueryClient(<ResearchNewsletters newsletters={[newsletter]} interviews={[interview]} />)

		expect(html).toContain('Research Notes Newsletters')
		expect(html).toContain('Weekly DeFi market structure')
		expect(html).toContain('27 Aug 2026')
		expect(html).toContain('href="https://defillama-research.beehiiv.com/p/market-structure"')
		expect(html).toContain('href="/newsletters"')
		expect(html).toContain('View all newsletters')
		expect(html).toContain('href="https://defillama-research.beehiiv.com/"')
		expect(html).toContain('Interviews')
		expect(html).toContain('href="/research/interview/protocol-founder"')
	})
})
