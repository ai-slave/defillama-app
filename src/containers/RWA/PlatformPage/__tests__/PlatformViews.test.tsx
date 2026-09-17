// @vitest-environment happy-dom

/* Behavioural contracts only, nothing here asserts on layout or class names:
   - the table mounts under Assets and Compliance with the view it is for, never under Information
   - the panels stay in the document under a table view, hidden, and show under Information
   - About and Compliance render on a bare meta; Fees, Entity, Regulation and Milestones only with content
   - the Website button prefers the referral link */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { spotAsset } from '../../table/__tests__/fixtures'
import type { RWAPlatformMeta } from '../api.types'
import type { RWAPlatformView } from '../view'

vi.mock('~/components/Link', () => ({
	BasicLink: ({ children }: { children: React.ReactNode }) => <span>{children}</span>
}))
vi.mock('~/components/TokenLogo', () => ({ TokenLogo: () => <span /> }))
vi.mock('~/components/Menu', () => ({ Menu: ({ name }: { name: string }) => <span>{name}</span> }))

import { foldRwaPlatformKpi } from '../../kpi/platformKpi'
import { RWAPlatformViews } from '../PlatformViews'

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

	test('renders About and Compliance on a bare meta, the other four only with content', async () => {
		await render('information')
		const headings = () => [...container.querySelectorAll('h2')].map((heading) => heading.textContent)
		expect(headings()).toEqual(['About Ondo', 'Compliance'])
		expect(container.textContent).toContain('Issuers on the platform')
		expect(container.textContent).toContain('Apollo')
		await render('information', {
			...bare,
			revenueModel: 'Management Fee',
			headquarters: 'New York',
			regulatoryStatus: 'SEC-registered transfer agent.',
			milestones: [{ date: '2026-05', event: 'FINRA approval' }]
		})
		expect(headings()).toEqual(['About Ondo', 'Entity', 'Regulation', 'Compliance', 'Fees & revenue', 'Milestones'])
		expect(container.textContent).toContain('FINRA approval')
	})

	test('uses a referral link for Website when available, the official one otherwise', async () => {
		await render('information', {
			...bare,
			website: ['https://official.example'],
			refLinks: ['https://referral.example']
		})
		let website = [...container.querySelectorAll('a')].find((link) => link.textContent === 'Website')
		expect(website?.getAttribute('href')).toBe('https://referral.example')
		await render('information', { ...bare, website: ['https://official.example'], refLinks: null })
		website = [...container.querySelectorAll('a')].find((link) => link.textContent === 'Website')
		expect(website?.getAttribute('href')).toBe('https://official.example')
	})
})
