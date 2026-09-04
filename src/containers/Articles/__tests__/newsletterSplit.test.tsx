import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ResearchSearchDialog } from '~/components/ResearchSearchDialog'
import { MobileSearch } from '~/components/Search'
import { ResearchFooter } from '~/containers/Articles/landing/ResearchFooter'
import { ResearchHero } from '~/containers/Articles/landing/ResearchHero'
import { ResearchLatest } from '~/containers/Articles/landing/ResearchLatest'
import { ResearchNewsletters } from '~/containers/Articles/landing/ResearchNewsletters'
import type { ResearchNewsletterItem } from '~/containers/Articles/newsletterFeed'
import type { ArticleDocument } from '~/containers/Articles/types'
import NewslettersPage from '~/pages/newsletters'

vi.mock('~/auth', () => ({
	useAuthContext: () => ({ user: null })
}))

vi.mock('~/layout', () => ({
	default: ({ children }: { children: ReactNode }) => <>{children}</>
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
	return renderToStaticMarkup(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>)
}

describe('newsletter and media-kit split', () => {
	it('renders the research footer as a media-kit request form with an internal newsletters link', () => {
		const html = renderWithQueryClient(<ResearchFooter />)

		expect(html).toContain('Get our media kit')
		expect(html).toContain('Get the media kit')
		expect(html).toContain('href="/newsletters"')
		expect(html).toContain('DefiLlama newsletters')
		expect(html).not.toContain('Subscribe &amp; get our media kit')
		expect(html).not.toContain('Download media kit')
		expect(html).not.toContain('/uploads/media-kit.pdf')
	})

	it('starts the newsletters page with both newsletters selected', () => {
		const html = renderWithQueryClient(<NewslettersPage />)

		expect(html).toContain('Subscribe for onchain fundamentals and analysis from DefiLlama')
		expect(html).toContain('Market updates and Research Notes')
		expect(html).toContain('Pick your publications')
		expect(html).toContain('Subscribe to either publication below, or select both.')
		expect(html.toLowerCase()).not.toContain('coming soon')
		expect(html).toContain('2/2 selected')
		expect(html).toContain('2 publications selected.')
		expect(html).toContain('DefiLlama Newsletter')
		expect(html).toContain('Research Notes')
		expect(html).toContain('/assets/defillama-newsletter-logo-light.png')
		expect(html).toContain('/assets/defillama-newsletter-logo-dark.png')
		expect(html).toContain('/assets/research_logo.webp')
		expect(html).toContain('/assets/research_logo_dark.webp')
		expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Enter email<\/button>/)
		expect(html.match(/aria-pressed="true"/g)).toHaveLength(2)
		expect(html).not.toContain('aria-pressed="false"')
		expect(html).not.toContain('Choose at least one newsletter.')
		expect(html).not.toContain('No newsletters selected yet')
		expect(html).not.toContain('Choose your stream')
		expect(html).not.toContain('Subscription starts after you submit')
		expect(html).not.toContain('Media-kit requests are handled separately from this page.')
		expect(html).not.toContain('We send a confirmation email before adding you to the selected list.')
	})

	it('renders a research hero subscribe button linked to the newsletters page', () => {
		const html = renderWithQueryClient(<ResearchHero title="Research" subtitle="Market intelligence" reports={[]} />)

		expect(html).toContain('href="/newsletters"')
		expect(html).toContain('aria-label="Subscribe to DefiLlama newsletters"')
		expect(html).toContain('>Subscribe</span>')
		expect(html).toContain('/icons/research/v2.svg#newsletter-mark')
		expect(html).not.toContain('/icons/research/v2.svg#newsletter"')
		expect(html).toContain('border-research-white')
		expect(html.match(/href="\/newsletters"/g)).toHaveLength(1)
		expect(html).not.toContain('newsletter.defillama.com')
	})

	it('renders the desktop Research search dialog trigger in the hero', () => {
		const html = renderWithQueryClient(<ResearchHero title="Research" subtitle="Market intelligence" reports={[]} />)

		expect(html).toContain('aria-label="Search DefiLlama Research"')
		expect(html).toContain('type="button"')
		expect(html).toContain('>Search</span>')
		expect(html).toContain('/icons/v44.svg#search')
		expect(html).not.toContain('href="/research?search=1"')
	})

	it('keeps the LlamaAI action before the Research search icon on mobile', () => {
		const html = renderWithQueryClient(<MobileSearch searchTrigger={<ResearchSearchDialog variant="mobile" />} />)

		const llamaAiPosition = html.indexOf('href="/ai"')
		const researchSearchPosition = html.indexOf('aria-label="Search DefiLlama Research"')
		expect(llamaAiPosition).toBeGreaterThan(-1)
		expect(researchSearchPosition).toBeGreaterThan(llamaAiPosition)
		expect(html).not.toContain('href="/research?search=1"')
	})

	it('uses a light border for latest article badges over cover images', () => {
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

		expect(html).toMatch(/<span class="[^"]*border-research-white[^"]*"[^>]*>INTERVIEW<\/span>/)
	})

	it('renders newsletter discovery, archive and subscription links with interviews', () => {
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
