import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

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
		id: 'mica',
		href: '/mica',
		label: 'MiCA venues',
		heading: 'MiCA-regulated exchanges',
		description: 'Compare EU-regulated exchanges by liquidity, fees, funding options, and verification requirements.'
	}
] as const

describe('Exchanges top-level navigation', () => {
	it.each(PAGES)('marks only the $label page as current and keeps its identity stable', (page) => {
		const html = renderToStaticMarkup(<ExchangesNav activePage={page.id} />)
		const currentLink = html.match(/<a[^>]*aria-current="page"[^>]*>[^<]*<\/a>/)?.[0]

		expect(currentLink).toContain(`href="${page.href}"`)
		expect(currentLink).not.toContain('data-tooltip-content')
		expect(html.match(/aria-current="page"/g)).toHaveLength(1)
		expect(html.match(/<h1[^>]*>/g)).toHaveLength(1)
		expect(html).toContain(`>${page.heading}</h1>`)
		expect(html).toContain(`>${page.description}</p>`)
	})

	it('uses real route links and exposes descriptions only as inactive-link tooltips', () => {
		const selected = PAGES[0]
		const html = renderToStaticMarkup(<ExchangesNav activePage={selected.id} />)

		for (const page of PAGES) {
			expect(html).toContain(`href="${page.href}"`)
			expect(html).toContain(`>${page.label}</a>`)
			if (page.id !== selected.id) {
				expect(html).toContain(`data-tooltip-content="${page.description}"`)
			}
		}

		expect(html).toContain(`>${selected.description}</p>`)
		expect(html).not.toContain('role="tab"')
		expect(html).not.toContain('role="tablist"')
	})
})
