// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
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

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/newsletters', asPath: '/newsletters', query: {} }) }))

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

	test('starts the newsletters page with both newsletters selected and submit disabled until an email', () => {
		const root = renderToDom(<NewslettersPage />)

		const pressed = [...root.querySelectorAll('[aria-label="Newsletters"] button[aria-pressed]')].map((button) =>
			button.getAttribute('aria-pressed')
		)
		expect(pressed).toEqual(['true', 'true'])
		const submit = [...root.querySelectorAll('button')].find((button) => button.textContent === 'Enter email')
		expect([submit?.getAttribute('aria-disabled'), submit?.disabled]).toEqual(['true', false])
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
