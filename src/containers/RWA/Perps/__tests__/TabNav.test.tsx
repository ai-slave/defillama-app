// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { RWAPerpsTabNav } from '../TabNav'

// The sub-pages are indexed list pages with their own canonicals, so the tabs are real links crawlers can follow.
test('renders every RWA perps page as a link and marks only the current one', () => {
	const container = document.createElement('div')
	container.innerHTML = renderToStaticMarkup(<RWAPerpsTabNav active="venues" />)
	const links = [...container.querySelectorAll('nav[aria-label="RWA perps pages"] a')]
	expect(links.map((link) => link.getAttribute('href'))).toEqual([
		'/rwa/perps',
		'/rwa/perps/venues',
		'/rwa/perps/assets',
		'/rwa/perps/asset-groups',
		'/rwa/perps/forex'
	])
	expect(links.filter((link) => link.getAttribute('aria-current') === 'page').map((link) => link.textContent)).toEqual([
		'Venues'
	])
})
