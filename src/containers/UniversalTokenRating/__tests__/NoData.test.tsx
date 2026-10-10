import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('next/router', () => ({
	useRouter: () => ({
		pathname: '/universal-token-rating',
		query: {},
		asPath: '/universal-token-rating',
		push: vi.fn(),
		replace: vi.fn()
	})
}))

import { UniversalTokenRating } from '..'
import { getFundraisingStatus, PreTgePerformance } from '../PreTgePerformance'
import { CantFindTokenBanner } from '../TokenPage'
import { TopMovers } from '../TopMovers'

describe('UTR empty states', () => {
	test('hides Top Movers when MoM data is unavailable', () => {
		expect(renderToStaticMarkup(<TopMovers movers={[]} />)).toBe('')
	})

	test('signs movers with canonical percent formatting and shows zero unsigned', () => {
		const html = renderToStaticMarkup(
			<TopMovers
				movers={[
					{ asset: 'flat', name: 'Flat', momChangePct: 0 },
					{ asset: 'down', name: 'Down', momChangePct: -1.234 }
				]}
			/>
		)

		expect(html).toContain('>0%<')
		expect(html).not.toContain('+0%')
		expect(html).toContain('-1.23%')
	})

	test('shows the last fundraising round, falling back to whether fundraising was reported', () => {
		expect(getFundraisingStatus(true, 'Strategic')).toBe('Strategic')
		expect(getFundraisingStatus(null, 'Seed')).toBe('Seed')
		expect(getFundraisingStatus(true, null)).toBe('Fundraising reported')
		expect(getFundraisingStatus(false, null)).toBe('No fundraising reported')
	})

	test('hides pre-TGE performance when no metrics are available', () => {
		expect(renderToStaticMarkup(<PreTgePerformance hasFundraising={null} lastRound={null} />)).toBe('')
	})

	test('links the missing-token CTA to the UTR application form', () => {
		const html = renderToStaticMarkup(<CantFindTokenBanner />)
		const links = [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map(([, href, name]) => [href, name])

		// One link per breakpoint layout.
		expect(links).toEqual([
			['/universal-token-rating/join', 'Apply for UTR'],
			['/universal-token-rating/join', 'Apply for UTR']
		])
	})

	test('uses the API scored count instead of the number of rendered rows', () => {
		const html = renderToStaticMarkup(
			<QueryClientProvider client={new QueryClient()}>
				<UniversalTokenRating
					universe={{
						scoredCount: 128,
						totalCount: 139,
						rows: [
							{
								asset: 'example',
								name: 'Example',
								symbol: 'EXP',
								sector: 'DeFi',
								listingStatus: 'listed',
								disclosureLevel: 'full',
								claimed: false,
								fdvUsd: null,
								scores: {
									overall: null,
									overallMomChangePct: null,
									disclosure: null,
									performance: null,
									rank: null,
									disclosureRubrics: [],
									performanceRubrics: []
								}
							}
						]
					}}
					topMovers={[]}
				/>
			</QueryClientProvider>
		)

		expect(html.replace(/<[^>]*>/g, '')).toContain('128 of 139 tokens scored')
		expect(html.replace(/<[^>]*>/g, '')).not.toContain('1 of 139 tokens scored')
	})
})
