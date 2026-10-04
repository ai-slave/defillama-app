import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import type { UtrUniverse } from '../types'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/', asPath: '/', query: {} }) }))

import UniversalTokenRatingClaimPage from '~/pages/universal-token-rating/claim'
import UniversalTokenRatingComparePage from '~/pages/universal-token-rating/compare'
import UniversalTokenRatingPage from '~/pages/universal-token-rating/index'
import UniversalTokenRatingJoinPage from '~/pages/universal-token-rating/join'
import UniversalTokenRatingTokenPage from '~/pages/universal-token-rating/token/[asset]'

function renderPage<Props extends object>(Component: ComponentType<Props>, props: Props) {
	const client = new QueryClient()
	try {
		const html = renderToStaticMarkup(
			<QueryClientProvider client={client}>
				<AuthProvider>
					<Component {...props} />
				</AuthProvider>
			</QueryClientProvider>
		)
		return html.match(/<main[^>]*>([\s\S]*?)<\/main>/)![1].replace(/<[^>]*>/g, '')
	} finally {
		client.clear()
	}
}

describe('public UTR pages', () => {
	test('renders every route without an auth or preview access gate', () => {
		const universe: UtrUniverse = {
			rows: [
				{
					asset: 'meteora',
					name: 'Meteora',
					symbol: 'MET',
					sector: 'DeFi',
					listingStatus: 'listed',
					disclosureLevel: 'full',
					claimed: false,
					fdvUsd: 100,
					grade: 'AAA',
					scores: {
						overall: 60,
						overallMomChangePct: 2,
						disclosure: 8,
						performance: 7.5,
						rank: 1,
						disclosureRubrics: [],
						performanceRubrics: []
					}
				}
			],
			scoredCount: 1,
			totalCount: 1
		}

		// Each route must show its own content, not only a title that a gate could also render.
		expect(renderPage(UniversalTokenRatingPage, { universe, topMovers: [], scoringConfig: null })).toContain(
			'1 of 1 tokens scored'
		)
		expect(renderPage(UniversalTokenRatingComparePage, { universe, scoringConfig: null })).toContain('Token A:')
		expect(
			renderPage(UniversalTokenRatingClaimPage, {
				projects: [],
				exchangeOptions: [],
				marketMakerOptions: [],
				scoringConfig: null
			})
		).toContain('Token list unavailable')
		expect(
			renderPage(UniversalTokenRatingJoinPage, { exchangeOptions: [], marketMakerOptions: [], scoringConfig: null })
		).toContain('Token to claim')
		expect(
			renderPage(UniversalTokenRatingTokenPage, {
				live: {
					projectName: 'Meteora',
					coingeckoId: 'meteora',
					arcticId: 'meteora',
					symbol: 'MET',
					tgeStatus: 'post-tge',
					metrics: null,
					charts: {
						marketQuality: null,
						pricePerformance: null,
						bidAskSpread: null,
						openInterest: null,
						fundingRate: null,
						cexVsDexVolume: null,
						cexVsDexDepth: null,
						spotVsPerpsVolume: null,
						spotVsPerpsDepth: null
					},
					sector: null,
					cmcId: null,
					notRated: true,
					rank: null,
					momChangePct: null,
					fdvUsd: null,
					asOf: null,
					lastEditedAt: null,
					configVersion: 1,
					generatedAt: '2026-01-01',
					disclosure: null,
					performance: null,
					overallScore: null,
					grade: null,
					ratedCount: 0,
					totalCount: 1,
					gradedCount: 0,
					criteriaCount: 0
				},
				legacy: null,
				exchanges: null,
				scoringConfig: null,
				iconDataUrl: null,
				defillamaDescription: null,
				disclosures: null
			})
		).toContain('Meteora')
	})
})
