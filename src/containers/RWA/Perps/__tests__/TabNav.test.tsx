// @vitest-environment happy-dom
import { existsSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { RWAPerpsTabNav } from '../TabNav'

// The sub-pages are indexed list pages with their own canonicals, so the tabs are real links crawlers can follow.
test('every RWA perps tab links to an existing page and only the current one is marked', () => {
	const container = document.createElement('div')
	container.innerHTML = renderToStaticMarkup(<RWAPerpsTabNav active="venues" />)
	const links = [...container.querySelectorAll('nav[aria-label="RWA perps pages"] a')]
	for (const link of links) {
		const page = path.join(process.cwd(), 'src/pages', link.getAttribute('href')!)
		expect([`${page}.tsx`, `${page}/index.tsx`].some(existsSync), link.getAttribute('href')!).toBe(true)
	}
	expect(links.filter((link) => link.getAttribute('aria-current') === 'page').map((link) => link.textContent)).toEqual([
		'Venues'
	])
})
