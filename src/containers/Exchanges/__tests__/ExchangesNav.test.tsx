// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { ExchangesNav, type ExchangesPage } from '../ExchangesNav'

function renderNav(activePage: ExchangesPage, country: string | null = null) {
	const container = document.createElement('div')
	container.innerHTML = renderToStaticMarkup(<ExchangesNav activePage={activePage} country={country} />)
	return container
}

describe('Exchanges top-level navigation', () => {
	test.each([
		['exchanges', '/exchanges', 'Exchanges'],
		['rank', '/exchanges/rank', 'REAL ranking'],
		['reserves', '/cexs', 'Exchange reserves'],
		['charts', '/exchanges/charts', 'Exchange charts'],
		['tokens', '/exchanges/tokens', 'Find exchanges by token'],
		['ramp', '/ramp', 'Fiat on-ramp and off-ramp costs']
	] as const)('marks only the %s page as current and names it in the heading', (page, href, heading) => {
		const container = renderNav(page)
		const currentLinks = [...container.querySelectorAll('a[aria-current="page"]')]

		expect(currentLinks.map((link) => link.getAttribute('href'))).toEqual([href])
		expect(container.querySelector('h1')?.textContent).toBe(heading)
	})

	test('preserves country only between country-aware pages', () => {
		const hrefs = [...renderNav('exchanges', 'DE').querySelectorAll('nav a')].map((link) => link.getAttribute('href'))

		expect(hrefs).toEqual([
			'/exchanges?country=de',
			'/exchanges/rank',
			'/cexs',
			'/exchanges/charts',
			'/exchanges/tokens?country=de',
			'/ramp?country=de'
		])
	})

	test('shows the page blurb except where the page already states it', () => {
		expect(renderNav('rank').querySelector('p')?.textContent).toMatch(/\w/)
		expect(renderNav('exchanges').querySelector('p')).toBeNull()
		expect(renderNav('charts').querySelector('p')).toBeNull()
	})
})
