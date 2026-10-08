// @vitest-environment happy-dom

/* Behavioural contracts only, nothing here asserts on layout or class names:
   - each view shows its own content: the table under Assets, the profile under Information
   - the profile stays in the served HTML under the table view, hidden, for crawlers
   - About and Compliance render on a bare meta; Fees, Entity, Regulation and Milestones only with content
   - a platform that also runs a perps venue links to the venue page from About
   The Website link choice is covered by getRwaPlatformLinks in panels/__tests__/panelData.test.ts.
   Reading and writing the view in the URL is covered by view.test.ts; the view tabs, links in the page's top row, by
   layout/__tests__/pageTabs.test.ts. */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { foldRwaPlatformKpi } from '../../kpi/platformKpi'
import { spotAsset } from '../../table/__tests__/fixtures'
import type { RWAPlatformMeta } from '../api.types'
import { RWAPlatformViews } from '../PlatformViews'
import type { RWAEntityView } from '../view'

const PROFILE_COPY = 'Ondo Finance is the largest pure-play RWA platform.'

const bare = {
	name: 'Ondo',
	slug: 'ondo',
	description: PROFILE_COPY,
	logo: null,
	platformType: null,
	category: null,
	accessModel: null,
	website: null,
	refLinks: null,
	docs: null,
	protocolSlug: null,
	foundersParsed: [],
	founders: null,
	milestones: [],
	keyMilestones: null,
	suspicious: false
} as unknown as RWAPlatformMeta

const kpi = foldRwaPlatformKpi([spotAsset(), spotAsset({ id: 'b', canonicalMarketId: 'b', issuer: 'Apollo' })], {
	includeBridgeTvl: true
})

function PlatformPage({
	initialView,
	meta = bare,
	perpsVenueHref = null
}: {
	initialView: RWAEntityView
	meta?: RWAPlatformMeta
	perpsVenueHref?: string | null
}) {
	return (
		<RWAPlatformViews
			meta={meta}
			kpi={kpi}
			view={initialView}
			perpsVenueHref={perpsVenueHref}
			renderTable={() => <div>the assets table</div>}
		/>
	)
}

describe('RWA platform views', () => {
	let container: HTMLDivElement
	let root: Root

	const render = (initialView: RWAEntityView, meta?: RWAPlatformMeta) =>
		act(async () => {
			root.render(<PlatformPage initialView={initialView} meta={meta} />)
		})
	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('shows the table under Assets and the profile under Information', async () => {
		await render('list')
		expect(container.textContent).toContain('the assets table')
		expect(container.querySelector('[hidden]')!.textContent).toContain(PROFILE_COPY)

		await render('information')
		expect(container.textContent).not.toContain('the assets table')
		expect(container.querySelector('[hidden]')).toBeNull()
		expect(container.textContent).toContain(PROFILE_COPY)
	})

	test('serves the profile copy under the table view, hidden', () => {
		const html = renderToStaticMarkup(<PlatformPage initialView="list" />)
		const document = new DOMParser().parseFromString(html, 'text/html')
		expect(document.querySelector('[hidden]')!.textContent).toContain(PROFILE_COPY)
		expect(document.body.textContent).toContain('the assets table')
	})

	test('hides the panels a bare meta has nothing to say in', async () => {
		await render('information')
		const headings = [...container.querySelectorAll('h2')].map((heading) => heading.textContent)
		expect(headings).toEqual(['About Ondo', 'Compliance'])
	})

	test('links a platform that also runs a perps venue to its venue page from About', () => {
		const venueLink = (perpsVenueHref: string | null) => {
			const html = renderToStaticMarkup(<PlatformPage initialView="information" perpsVenueHref={perpsVenueHref} />)
			const link = [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('a')].find(
				(anchor) => anchor.textContent === 'Perps on the venue page'
			)
			return link?.getAttribute('href') ?? null
		}
		expect(venueLink('/rwa/perps/venue/ondo')).toBe('/rwa/perps/venue/ondo')
		expect(venueLink(null)).toBeNull()
	})
})
