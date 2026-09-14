import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('~/ui/Tooltip', async () => {
	const { cloneElement } = await import('react')
	return {
		Tooltip: ({
			content,
			children,
			render
		}: {
			content: string
			children: ReactNode
			render: ReactElement<{ 'data-tooltip-content'?: string }>
		}) => cloneElement(render, { 'data-tooltip-content': content }, children)
	}
})

import { ExchangesNav } from '../ExchangesNav'

const PAGES = [
	{
		id: 'exchanges',
		href: '/exchanges',
		label: 'Exchanges',
		heading: 'Exchanges',
		description: 'Activity, liquidity, fees, and compliance across CEXs and DEXs.'
	},
	{
		id: 'reserves',
		href: '/cexs',
		label: 'Reserves',
		heading: 'Exchange reserves',
		description: 'Tracked CEX wallet assets, clean reserves, and net inflows.'
	},
	{
		id: 'charts',
		href: '/exchanges/charts',
		label: 'Charts',
		heading: 'Exchange charts',
		description: 'Historical volume, open interest, depth, and normalized volume across exchanges.'
	},
	{
		id: 'tokens',
		href: '/exchanges/tokens',
		label: 'Token finder',
		heading: 'Find exchanges by token',
		description: 'Find exchanges and market segments listing all or any selected tokens.'
	}
] as const

const renderNav = (activePage: (typeof PAGES)[number]['id']) =>
	renderToStaticMarkup(<ExchangesNav activePage={activePage} />)

describe('Exchanges top-level navigation', () => {
	test.each(PAGES)('marks only the $label page as current and keeps its identity stable', (page) => {
		const html = renderNav(page.id)
		const currentLink = html.match(/<a[^>]*aria-current="page"[^>]*>[^<]*<\/a>/)?.[0]

		expect(currentLink).toContain(`href="${page.href}"`)
		expect(currentLink).not.toContain('data-tooltip-content')
		expect(html.match(/aria-current="page"/g)).toHaveLength(1)
		expect(html.match(/<h1[^>]*>/g)).toHaveLength(1)
		expect(html).toContain(`>${page.heading}</h1>`)
		// Directory and charts drop the blurb: each already says the same thing in its own content.
		expect(html.includes(`>${page.description}</p>`)).toBe(page.id !== 'exchanges' && page.id !== 'charts')
	})

	test('uses real route links and exposes descriptions only as inactive-link tooltips', () => {
		const selected = PAGES[0]
		const html = renderNav(selected.id)

		for (const page of PAGES) {
			expect(html).toContain(`href="${page.href}"`)
			expect(html).toContain(`>${page.label}</a>`)
		}
		const inactive = PAGES.filter((page) => page.id !== selected.id)
		expect(inactive.length).toBeGreaterThan(0)
		for (const page of inactive) {
			expect(html).toContain(`data-tooltip-content="${page.description}"`)
		}

		expect(html).not.toContain(`>${selected.description}</p>`)
		expect(html).not.toContain('/mica')
		expect(html).not.toContain('MiCA venues')
		expect(html).not.toContain('role="tab"')
		expect(html).not.toContain('role="tablist"')
	})

	test('preserves country only between country-aware pages', () => {
		const html = renderToStaticMarkup(<ExchangesNav activePage="exchanges" country="DE" />)

		expect(html).toContain('href="/exchanges?country=de"')
		expect(html).toContain('href="/exchanges/tokens?country=de"')
		expect(html).toContain('href="/exchanges/charts"')
		expect(html).not.toContain('/mica')
		expect(html).not.toContain('/exchanges/charts?country=de')
	})
})
