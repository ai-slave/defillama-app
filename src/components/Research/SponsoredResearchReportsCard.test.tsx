// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { SponsoredResearchReportSummary } from '~/containers/Articles/types'
import { SponsoredResearchReportsCard } from './SponsoredResearchReportsCard'

const mocks = vi.hoisted(() => ({ trackUmamiEvent: vi.fn() }))

vi.mock('next/link', () => ({
	default: ({
		children,
		href,
		prefetch: _prefetch,
		...props
	}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => (
		<a href={href} {...props}>
			{children}
		</a>
	)
}))

vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: mocks.trackUmamiEvent }))

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

describe('SponsoredResearchReportsCard', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		mocks.trackUmamiEvent.mockReset()
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('renders nothing when no published reports are available', () => {
		expect(
			renderToStaticMarkup(<SponsoredResearchReportsCard reports={[]} entityType="chain" entitySlug="starknet" />)
		).toBe('')
	})

	test('renders multiple report sections and tracks the sponsor identity', async () => {
		const html = renderToStaticMarkup(
			<SponsoredResearchReportsCard reports={reports} entityType="chain" entitySlug="starknet" layout="grid" />
		)

		expect(html).toContain('Latest from DefiLlama Research')
		expect(html).toContain('/research/spotlight/how-starknet-is-reimagining-privacy')
		expect(html).toContain('/research/report/the-btcfi-chain-future-is-bright')
		expect(html.indexOf(reports[0].title)).toBeLessThan(html.indexOf(reports[1].title))

		await act(async () =>
			root.render(
				<SponsoredResearchReportsCard reports={reports} entityType="chain" entitySlug="starknet" layout="grid" />
			)
		)
		const reportLink = container.querySelector<HTMLAnchorElement>(
			'a[href="/research/spotlight/how-starknet-is-reimagining-privacy"]'
		)
		await act(async () => reportLink?.click())

		expect(mocks.trackUmamiEvent).toHaveBeenCalledWith('sponsored-research-report-click', {
			'entity-type': 'chain',
			entity: 'starknet',
			'article-id': 'spotlight-id'
		})
	})
})
