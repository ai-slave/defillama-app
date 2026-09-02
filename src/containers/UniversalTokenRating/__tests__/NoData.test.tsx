import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

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
import { PreTgePerformance } from '../PreTgePerformance'
import { CantFindTokenBanner } from '../TokenPage'
import { TopMovers } from '../TopMovers'

describe('UTR empty states', () => {
	it('hides Top Movers when MoM data is unavailable', () => {
		expect(renderToStaticMarkup(<TopMovers movers={[]} />)).toBe('')
	})

	it('keeps explicit mover signs while using canonical percent formatting', () => {
		const html = renderToStaticMarkup(
			<TopMovers
				movers={[
					{ asset: 'flat', name: 'Flat', momChangePct: 0 },
					{ asset: 'down', name: 'Down', momChangePct: -1.234 }
				]}
			/>
		)

		expect(html).toContain('+0%')
		expect(html).toContain('-1.23%')
	})

	it('keeps available fundraising metadata without empty cards', () => {
		const html = renderToStaticMarkup(<PreTgePerformance hasFundraising lastRound="Strategic" />)

		expect(html).toContain('Strategic')
		expect(html).not.toContain('NO DATA YET')
		expect(html).not.toContain('Total Amount Fundraised')
	})

	it('hides pre-TGE performance when no metrics are available', () => {
		expect(renderToStaticMarkup(<PreTgePerformance hasFundraising={null} lastRound={null} />)).toBe('')
	})

	it('links the missing-token CTA to the UTR application form without account-creation copy', () => {
		const html = renderToStaticMarkup(<CantFindTokenBanner />)

		expect(html).toContain('Apply for UTR')
		expect(html).toContain('/universal-token-rating/join')
		expect(html).not.toContain('Join Forgd')
		expect(html).not.toContain('Create an account')
	})

	it('uses the API scored count instead of the number of rendered rows', () => {
		const html = renderToStaticMarkup(
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
		)

		expect(html).toContain('<strong class="text-primary">128</strong> of 139 tokens scored')
		expect(html).not.toContain('<strong class="text-primary">1</strong> of 139 tokens scored')
	})
})
