// @vitest-environment happy-dom

/* Behavioural contracts only, nothing here asserts on layout or class names:
   - the table mounts under Assets and Compliance with the view it is for, never under Information
   - the panels stay in the document under a table view, hidden, and show under Information
   - About and Compliance render on a bare meta; Fees, Entity, Regulation and Milestones only with content
   The Website link choice is covered by getRwaPlatformLinks in panels/__tests__/panelData.test.ts. */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { foldRwaPlatformKpi } from '../../kpi/platformKpi'
import { spotAsset } from '../../table/__tests__/fixtures'
import type { RWAPlatformMeta } from '../api.types'
import { RWAPlatformViews } from '../PlatformViews'
import type { RWAPlatformView } from '../view'

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

describe('RWA platform views', () => {
	let container: HTMLDivElement
	let root: Root
	const tableMounted = vi.fn()

	const render = (view: RWAPlatformView, meta: RWAPlatformMeta = bare) =>
		act(async () => {
			root.render(
				<RWAPlatformViews
					meta={meta}
					kpi={kpi}
					view={view}
					renderTable={(tableView) => {
						tableMounted(tableView)
						return <div>the table</div>
					}}
				/>
			)
		})

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		tableMounted.mockReset()
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.restoreAllMocks()
	})

	test('mounts the table under Assets and Compliance with the view it is for, never under Information', async () => {
		await render('assets')
		expect(tableMounted).toHaveBeenLastCalledWith('assets')
		await render('compliance')
		expect(tableMounted).toHaveBeenLastCalledWith('compliance')
		tableMounted.mockReset()
		await render('information')
		expect(tableMounted).not.toHaveBeenCalled()
		expect(container.textContent).not.toContain('the table')
	})

	test('keeps the panels in the document under a table view, hidden, and shows them under Information', async () => {
		await render('assets')
		expect(container.querySelector('[hidden]')?.textContent).toContain(PROFILE_COPY)
		await render('information')
		expect(container.querySelector('[hidden]')).toBeNull()
		expect(container.textContent).toContain(PROFILE_COPY)
	})

	test('hides the panels a bare meta has nothing to say in', async () => {
		await render('information')
		const headings = [...container.querySelectorAll('h2')].map((heading) => heading.textContent)
		expect(headings).toEqual(['About Ondo', 'Compliance'])
	})
})
