// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { SponsoredResearchReportSummary } from '~/containers/Articles/types'
import { installUmamiSink } from '~/utils/test/umamiSink'
import { SponsoredResearchReportsCard } from './SponsoredResearchReportsCard'

const track = installUmamiSink()

const reports: Array<SponsoredResearchReportSummary> = [
	{
		id: 'spotlight-id',
		title: 'How Starknet Is Reimagining Privacy',
		slug: 'how-starknet-is-reimagining-privacy',
		section: 'spotlight',
		coverImage: null,
		carouselImage: { url: 'https://example.com/starknet.webp', alt: 'Starknet' },
		excerpt: null,
		reportDescription: null,
		displayDate: '2026-08-12T00:00:00.000Z',
		publishedAt: '2026-08-11T00:00:00.000Z'
	},
	{
		id: 'report-id',
		title: 'The BTCFi Chain Future Is Bright',
		slug: 'the-btcfi-chain-future-is-bright',
		section: 'report',
		coverImage: null,
		carouselImage: null,
		excerpt: null,
		reportDescription: null,
		displayDate: null,
		publishedAt: '2026-08-10T00:00:00.000Z'
	}
]

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('an entity without published reports shows no research card', async () => {
	await act(async () =>
		root.render(<SponsoredResearchReportsCard reports={[]} entityType="chain" entitySlug="starknet" />)
	)
	expect(container.innerHTML).toBe('')
})

test('each report links to its own section in order and a click reports the sponsor identity', async () => {
	await act(async () =>
		root.render(
			<SponsoredResearchReportsCard reports={reports} entityType="chain" entitySlug="starknet" layout="grid" />
		)
	)
	const reportLinks = [...container.querySelectorAll('a')]
		.map((link) => link.getAttribute('href'))
		.filter((href) => href !== '/research')
	expect(reportLinks).toEqual([
		'/research/spotlight/how-starknet-is-reimagining-privacy',
		'/research/report/the-btcfi-chain-future-is-bright'
	])

	// Keep happy-dom from navigating away after the app handled the click.
	const stayOnPage = (event: Event) => event.preventDefault()
	window.addEventListener('click', stayOnPage)
	await act(async () => container.querySelector<HTMLAnchorElement>('a[href^="/research/spotlight/"]')!.click())

	window.removeEventListener('click', stayOnPage)
	expect(track).toHaveBeenCalledWith('sponsored-research-report-click', {
		'entity-type': 'chain',
		entity: 'starknet',
		'article-id': 'spotlight-id'
	})
})
