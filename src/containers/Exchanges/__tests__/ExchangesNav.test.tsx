// @vitest-environment happy-dom
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
	{ id: 'exchanges', href: '/exchanges' },
	{ id: 'rank', href: '/exchanges/rank' },
	{ id: 'reserves', href: '/cexs' },
	{ id: 'charts', href: '/exchanges/charts' },
	{ id: 'tokens', href: '/exchanges/tokens' },
	{ id: 'ramp', href: '/ramp' }
] as const

function renderNav(activePage: (typeof PAGES)[number]['id'], country: string | null = null) {
	const container = document.createElement('div')
	container.innerHTML = renderToStaticMarkup(<ExchangesNav activePage={activePage} country={country} />)
	return container
}

describe('Exchanges top-level navigation', () => {
	test.each(PAGES)('marks only the $id page as current', (page) => {
		const container = renderNav(page.id)
		const currentLinks = container.querySelectorAll('a[aria-current="page"]')

		expect(currentLinks).toHaveLength(1)
		expect(currentLinks[0].getAttribute('href')).toBe(page.href)
		expect(currentLinks[0].hasAttribute('data-tooltip-content')).toBe(false)
		expect(container.querySelectorAll('h1')).toHaveLength(1)
		expect(container.querySelector('h1')?.textContent?.trim()).toBeTruthy()
	})

	test('uses real route links with descriptions on inactive links', () => {
		const container = renderNav('exchanges')

		for (const page of PAGES) {
			const link = container.querySelector(`a[href="${page.href}"]`)
			expect(link?.textContent?.trim()).toBeTruthy()
		}
		for (const page of PAGES.filter((page) => page.id !== 'exchanges')) {
			const link = container.querySelector(`a[href="${page.href}"]`)
			expect(link?.getAttribute('data-tooltip-content')?.trim()).toBeTruthy()
		}

		expect(container.querySelector('[role="tab"], [role="tablist"]')).toBeNull()
	})

	test('preserves country only between country-aware pages', () => {
		const container = renderNav('exchanges', 'DE')
		const hrefs = [...container.querySelectorAll('nav a')].map((link) => link.getAttribute('href'))

		expect(new Set(hrefs)).toEqual(
			new Set([
				'/exchanges?country=de',
				'/exchanges/rank',
				'/cexs',
				'/exchanges/charts',
				'/exchanges/tokens?country=de',
				'/ramp?country=de'
			])
		)
	})
})
