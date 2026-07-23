import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ResearchFooter } from '~/containers/Articles/landing/ResearchFooter'
import { ResearchHero } from '~/containers/Articles/landing/ResearchHero'
import NewslettersPage from '~/pages/newsletters'
import defillamaPages from '~/public/pages.json'

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

		expect(html).toContain('Choose your DefiLlama newsletters')
		expect(html).toContain('Available newsletters')
		expect(html).toContain('Market updates and Research Notes')
		expect(html).toContain('Pick the lists you want to receive at this email.')
		expect(html).toContain('Pick your publications')
		expect(html).toContain('Subscribe to either publication below, or select both.')
		expect(html.toLowerCase()).not.toContain('coming soon')
		expect(html).toContain('2/2 selected')
		expect(html).toContain('2 publications selected.')
		expect(html).toContain('DefiLlama Newsletter + Research Notes')
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
		expect(html.match(/href="\/newsletters"/g)).toHaveLength(1)
		expect(html).not.toContain('newsletter.defillama.com')
	})

	it('does not expose newsletters as a main navbar item', () => {
		expect(defillamaPages.Main.some((page) => page.route === '/newsletters')).toBe(false)
	})
})
