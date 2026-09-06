import type { ComponentType, ReactNode } from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('~/containers/UniversalTokenRating', () => ({
	UniversalTokenRating: () => <div>Universal Token Rating</div>
}))
vi.mock('~/containers/UniversalTokenRating/CompareTokens', () => ({
	CompareTokens: () => <div>Compare Tokens</div>
}))
vi.mock('~/containers/UniversalTokenRating/ClaimTokenProfile', () => ({
	ClaimTokenProfile: ({ variant }: { variant?: string }) => <div>{variant === 'join' ? 'Join UTR' : 'Claim Token'}</div>
}))
vi.mock('~/containers/UniversalTokenRating/TokenPageLive', () => ({
	TokenPageLive: () => <div>Meteora Token Page</div>
}))

import UniversalTokenRatingClaimPage from '~/pages/universal-token-rating/claim'
import UniversalTokenRatingComparePage from '~/pages/universal-token-rating/compare'
import UniversalTokenRatingPage from '~/pages/universal-token-rating/index'
import UniversalTokenRatingJoinPage from '~/pages/universal-token-rating/join'
import UniversalTokenRatingTokenPage from '~/pages/universal-token-rating/token/[asset]'

function renderPage(Page: unknown, props: Record<string, unknown> = {}) {
	return renderToStaticMarkup(createElement(Page as ComponentType<Record<string, unknown>>, props))
}

describe('public UTR pages', () => {
	test('renders every route without an auth or preview access gate', () => {
		const universe = { rows: [], scoredCount: 0, totalCount: 0 }

		expect(renderPage(UniversalTokenRatingPage, { universe, topMovers: [], scoringConfig: null })).toContain(
			'Universal Token Rating'
		)
		expect(renderPage(UniversalTokenRatingComparePage, { universe, scoringConfig: null })).toContain('Compare Tokens')
		expect(
			renderPage(UniversalTokenRatingClaimPage, { projects: [], exchangeOptions: [], scoringConfig: null })
		).toContain('Claim Token')
		expect(renderPage(UniversalTokenRatingJoinPage, { exchangeOptions: [], scoringConfig: null })).toContain('Join UTR')
		expect(
			renderPage(UniversalTokenRatingTokenPage, {
				live: { projectName: 'Meteora', coingeckoId: 'meteora', arcticId: 'meteora' },
				legacy: null,
				exchanges: null,
				scoringConfig: null,
				iconDataUrl: null
			})
		).toContain('Meteora Token Page')
	})
})
