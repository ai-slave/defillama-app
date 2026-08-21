// @vitest-environment happy-dom

/* Behavioural contracts only — nothing here asserts on layout or class names,
   so the views can be restyled freely:
   - the peer dataset is fetched on demand, never on page load
   - the profile copy stays in the document whichever view is showing (SEO)
   - information disclosures are expanded by default
   - the selected view is shareable through ?view=
   - an unavailable view falls back instead of rendering an empty panel */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RWAPlatformMeta } from './api.types'
import type { RWAPlatformPageData } from './types'

const mocks = vi.hoisted(() => ({
	push: vi.fn(),
	query: {} as Record<string, string | string[] | undefined>,
	peerRankingMounted: vi.fn(),
	assetsTableMounted: vi.fn()
}))

vi.mock('next/router', () => ({
	useRouter: () => ({
		query: mocks.query,
		pathname: '/rwa/platform/[platform]',
		asPath: '/rwa/platform/ondo',
		push: mocks.push
	})
}))
vi.mock('~/components/Link', () => ({
	BasicLink: ({ children }: { children: React.ReactNode }) => <span>{children}</span>
}))
vi.mock('~/components/TokenLogo', () => ({ TokenLogo: () => <span /> }))
vi.mock('~/components/Menu', () => ({ Menu: ({ name }: { name: string }) => <span>{name}</span> }))
// The peer table is the only view that fetches, so standing in for it turns
// "does it fetch?" into "is it mounted?".
vi.mock('./PeerRanking', () => ({
	PeerRanking: () => {
		mocks.peerRankingMounted()
		return <span />
	}
}))

import { parseRWAPlatformDataView, RWAPlatformDataViews } from './index'

const PROFILE_COPY = 'Ondo Finance is the largest pure-play RWA platform.'

const meta = {
	name: 'Ondo',
	slug: 'ondo',
	description: PROFILE_COPY,
	logo: null,
	onchainAum: 1_000,
	issuer: 'Ondo Finance Inc.',
	foundersParsed: [],
	milestones: [],
	platformType: null,
	category: null,
	accessModel: null,
	primaryChain: 'ethereum',
	holderTotalFeeBps: 25
} as unknown as RWAPlatformMeta

const data: RWAPlatformPageData = {
	meta,
	assetCount: 3,
	chainCount: 2,
	categoryMix: [{ name: 'Stocks & Equities', count: 3 }],
	assetClassMix: [],
	chainMix: [],
	dominantAccessModel: null,
	attestedAssetCount: 3,
	defiActiveTvl: 100,
	bridgeTvl: 0,
	defiActiveTvlToAumPct: 10
}

// The real table renders the view switcher in its panel header; the stand-in
// keeps that so switching views is reachable from the assets view.
const renderAssetsTable = (viewSwitch: React.ReactNode) => {
	mocks.assetsTableMounted()
	return <div>{viewSwitch}</div>
}

describe('RWA platform data views', () => {
	let container: HTMLDivElement
	let root: Root

	const render = (pageData: RWAPlatformPageData = data) =>
		act(async () => {
			root.render(<RWAPlatformDataViews data={pageData} renderAssetsTable={renderAssetsTable} />)
		})

	const selectView = (label: string) =>
		act(async () => {
			const controls = [...container.querySelectorAll('button')]
			controls.find((control) => control.textContent === label)?.click()
		})

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		mocks.query = {}
		mocks.push.mockReset()
		mocks.peerRankingMounted.mockReset()
		mocks.assetsTableMounted.mockReset()
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.restoreAllMocks()
	})

	it('mounts the peer ranking only once the peers view is requested', async () => {
		await render()

		expect(mocks.assetsTableMounted).toHaveBeenCalled()
		expect(mocks.peerRankingMounted).not.toHaveBeenCalled()

		mocks.query = { view: 'peers' }
		await render()

		expect(mocks.peerRankingMounted).toHaveBeenCalled()
	})

	it('keeps the profile copy in the document while another view is showing', async () => {
		await render()
		expect(container.textContent).toContain(PROFILE_COPY)

		mocks.query = { view: 'peers' }
		await render()
		expect(container.textContent).toContain(PROFILE_COPY)
	})

	it('uses a referral link for Website when available instead of showing it as a reference', async () => {
		await render({
			...data,
			meta: {
				...meta,
				website: ['https://official.example'],
				refLinks: ['https://referral.example']
			} as RWAPlatformMeta
		})

		const website = [...container.querySelectorAll('a')].find((link) => link.textContent === 'Website')
		expect(website?.getAttribute('href')).toBe('https://referral.example')
		expect(container.textContent).not.toContain('Reference')
	})

	it('keeps the official Website link when no referral is available', async () => {
		await render({
			...data,
			meta: { ...meta, website: ['https://official.example'], refLinks: null } as RWAPlatformMeta
		})

		const website = [...container.querySelectorAll('a')].find((link) => link.textContent === 'Website')
		expect(website?.getAttribute('href')).toBe('https://official.example')
	})

	it('hides Llama Grade attestation without hiding other attestation details', async () => {
		await render({
			...data,
			meta: {
				...meta,
				attestationFrequency: 'Monthly',
				llamaGradeAttestation: true
			} as RWAPlatformMeta
		})

		expect(container.textContent).toContain('Attestation frequency')
		expect(container.textContent).toContain('Monthly')
		expect(container.textContent).not.toContain('Llama-grade attestation')
	})

	it('does not show an empty attestation group for Llama Grade alone', async () => {
		await render({
			...data,
			meta: { ...meta, llamaGradeAttestation: true } as RWAPlatformMeta
		})

		expect(container.textContent).not.toContain('Attestations & milestones')
	})

	it('expands the information disclosures by default', async () => {
		await render({
			...data,
			meta: {
				...meta,
				revenueModel: 'Management fees',
				founders: 'Jane Doe'
			} as RWAPlatformMeta
		})

		const disclosures = [...container.querySelectorAll('details')]
		expect(disclosures).toHaveLength(2)
		expect(disclosures.every((disclosure) => disclosure.open)).toBe(true)
	})

	it('publishes the selected view through ?view= and clears it for the default view', async () => {
		await render()
		await selectView('Information')
		expect(mocks.push.mock.calls[0]?.[0]?.query).toMatchObject({ view: 'information' })

		mocks.query = { view: 'information' }
		await render()
		await selectView('Assets')
		expect(mocks.push.mock.calls[1]?.[0]?.query).not.toHaveProperty('view')
	})

	it('falls back to the assets view when the requested mix has no rows', async () => {
		mocks.query = { view: 'mix' }
		await render({ ...data, categoryMix: [] })

		expect(mocks.assetsTableMounted).toHaveBeenCalled()
	})

	it('resolves unknown view names to the default view', () => {
		expect(parseRWAPlatformDataView(undefined)).toBe('assets')
		expect(parseRWAPlatformDataView('nope')).toBe('assets')
		expect(parseRWAPlatformDataView('peers')).toBe('peers')
	})
})
