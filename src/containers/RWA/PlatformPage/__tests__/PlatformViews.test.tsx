// @vitest-environment happy-dom

/* Behavioural contracts only, nothing here asserts on layout or class names:
   - each view shows its panel: the table under Assets and Compliance, the profile under Information
   - the profile panel stays in the served HTML under a table view, hidden, for crawlers
   - About and Compliance render on a bare meta; Fees, Entity, Regulation and Milestones only with content
   The Website link choice is covered by getRwaPlatformLinks in panels/__tests__/panelData.test.ts.
   Reading and writing the view in the URL is covered by view.test.ts; the tab strip's semantics by
   src/ui/__tests__/SelectionControls.behavior.test.tsx. */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { Tabs } from '~/ui/Tabs'
import { foldRwaPlatformKpi } from '../../kpi/platformKpi'
import { spotAsset } from '../../table/__tests__/fixtures'
import type { RWAPlatformMeta } from '../api.types'
import { RWAPlatformViews } from '../PlatformViews'
import { RWA_PLATFORM_VIEWS, type RWAPlatformView } from '../view'

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

/* The panels read the selected view from a `Tabs` provider, as on the page, where the provider also spans the view tabs. */
function Views({ view, meta = bare }: { view: RWAPlatformView; meta?: RWAPlatformMeta }) {
	return (
		<Tabs<RWAPlatformView> value={view} values={RWA_PLATFORM_VIEWS} onValueChange={() => {}}>
			<RWAPlatformViews
				meta={meta}
				kpi={kpi}
				view={view}
				renderTable={(tableView) => <div>the {tableView} table</div>}
			/>
		</Tabs>
	)
}

describe('RWA platform views', () => {
	let container: HTMLDivElement
	let root: Root

	const render = (view: RWAPlatformView, meta?: RWAPlatformMeta) =>
		act(async () => {
			root.render(<Views view={view} meta={meta} />)
		})
	const visiblePanel = () => container.querySelector('[role="tabpanel"]:not([hidden])')!

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

	test('each view shows its own panel', async () => {
		await render('assets')
		expect(visiblePanel().textContent).toBe('the assets table')

		await render('compliance')
		expect(visiblePanel().textContent).toBe('the compliance table')
		expect(container.textContent).not.toContain('the assets table')

		await render('information')
		expect(visiblePanel().textContent).toContain(PROFILE_COPY)
		expect(container.textContent).not.toContain('table')
	})

	test('serves the profile copy under a table view, in a hidden panel', () => {
		const html = renderToStaticMarkup(<Views view="assets" />)
		const document = new DOMParser().parseFromString(html, 'text/html')
		expect(document.querySelector('[role="tabpanel"][hidden]')!.textContent).toContain(PROFILE_COPY)
		expect(document.querySelector('[role="tabpanel"]:not([hidden])')!.textContent).toBe('the assets table')
	})

	test('hides the panels a bare meta has nothing to say in', async () => {
		await render('information')
		const headings = [...container.querySelectorAll('h2')].map((heading) => heading.textContent)
		expect(headings).toEqual(['About Ondo', 'Compliance'])
	})
})
