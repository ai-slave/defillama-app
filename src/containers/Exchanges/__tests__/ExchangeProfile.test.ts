import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { ExchangeProfile, resolveProfileSegment, visibleProfileTabs } from '../ExchangeProfile'
import {
	ExchangeRegionalInformation,
	profileInformationMetadata,
	resolveProfileCountryView
} from '../ExchangeRegionalInformation'
import type {
	ExchangeProfileModel,
	ExchangeRegionalMetadataModel,
	ExchangeRegionStatus,
	ExchangeSegment
} from '../models'
import { ProfileHistory } from '../ProfileHistory'

vi.mock('next/router', () => ({
	useRouter: () => ({ isReady: false, query: {} })
}))

function profile(slug: string, segments: Array<ExchangeSegment>): ExchangeProfileModel {
	return {
		slug,
		name: slug,
		kind: 'cex',
		profileMode: 'markets',
		defillamaUrl: null,
		defillamaCexSlug: null,
		execution: null,
		executionBySegment: {},
		quality: null,
		nativeToken: null,
		hacks: [],
		raises: [],
		reserves: null,
		segments: Object.fromEntries(
			segments.map((segment) => [
				segment,
				{
					segment,
					marketCount: 0,
					volume24h: null,
					volumePrevious24h: null,
					openInterestUsd: null,
					openInterestPreviousUsd: null,
					depth2Usd: null,
					capabilities: { openInterest: false, funding: false, depth: false },
					pairs: []
				}
			])
		),
		metadata: {
			website: null,
			referralUrl: null,
			twitterUrl: null,
			promotions: [],
			kpis: [],
			groups: []
		}
	}
}

describe('profile navigation segment resolution', () => {
	test('replaces a stale segment selection when navigation reuses the dynamic route', () => {
		// A perps-only venue's selection carried onto a spot-only venue must not stick.
		const previousSelection = resolveProfileSegment(profile('perps', ['linear_perp']), 'linear_perp')
		const nextSelection = resolveProfileSegment(profile('spot', ['spot']), previousSelection)

		expect(previousSelection).toBe('linear_perp')
		// The rollup is the fallback: every venue can serve it, whatever it trades.
		expect(nextSelection).toBe('all')
	})

	test('lands on the rollup with no selection, and honours one the venue can serve', () => {
		expect(resolveProfileSegment(profile('spot', ['spot']), null)).toBe('all')
		expect(resolveProfileSegment(profile('both', ['spot', 'linear_perp']), 'linear_perp')).toBe('linear_perp')
		// A venue with no markets at all has nothing to show, not even the rollup.
		expect(resolveProfileSegment(profile('empty', []), 'all')).toBeNull()
	})
})

describe('profile section navigation', () => {
	test('includes available profile sections', () => {
		expect(visibleProfileTabs(true, true, true).toSorted()).toEqual(['history', 'information', 'markets', 'reserves'])
		expect(visibleProfileTabs(false, false, false)).toEqual(['markets'])
	})
})

describe('profile country view states', () => {
	const query = (
		patch: {
			data?: ExchangeRegionalMetadataModel
			failed?: boolean
			isFetching?: boolean
		} = {}
	) => ({
		data: patch.data,
		isPlaceholderData: false,
		isFetching: patch.isFetching ?? false,
		// A failed attempt is one whose last error is newer than its last data, as queryReadFailed reads it.
		errorUpdatedAt: patch.failed ? 2 : 0,
		dataUpdatedAt: patch.data ? 1 : 0,
		refetch: vi.fn()
	})
	const regional = (availability: ExchangeRegionStatus): ExchangeRegionalMetadataModel => {
		const base = {
			country: 'DE',
			region: { key: 'eea', label: 'EU / EEA' },
			segments: availability === 'unavailable' ? ([] as []) : (['spot'] as Array<ExchangeSegment>),
			note: null,
			source: null,
			usedFallback: false,
			funding: null
		}
		if (availability === 'unavailable') return { ...base, availability, segments: [] }
		return { ...base, availability, metadata: profile('regional', []).metadata }
	}

	test('represents global, loading, and error without regional metadata', () => {
		expect(resolveProfileCountryView(null, query())).toEqual({ status: 'global' })
		expect(resolveProfileCountryView('DE', query({ isFetching: true }))).toEqual({
			status: 'loading',
			country: 'DE'
		})
		expect(resolveProfileCountryView('DE', query({ failed: true }))).toMatchObject({
			status: 'error',
			country: 'DE'
		})
		// Try again keeps the error and its button on screen while the read runs again.
		expect(resolveProfileCountryView('DE', query({ failed: true, isFetching: true }))).toMatchObject({
			status: 'error',
			query: { isFetching: true }
		})
	})

	test.each(['available', 'restricted', 'leaving', 'unavailable'] as const)(
		'represents the %s response as its own discriminated state',
		(availability) => {
			const view = resolveProfileCountryView('DE', query({ data: regional(availability) }))
			expect(view).toMatchObject({ status: availability, country: 'DE' })
			// A refetch that fails keeps the regional answer already shown.
			expect(resolveProfileCountryView('DE', query({ data: regional(availability), failed: true }))).toMatchObject({
				status: availability
			})
		}
	)

	test('uses regional information only for offered regional states', () => {
		const baseProfile = profile('venue', ['spot'])
		const regionalData = regional('restricted')
		if (regionalData.availability !== 'restricted') throw new Error('Expected restricted fixture')
		regionalData.metadata.groups = [
			{
				key: 'regulation',
				title: 'Regional regulation',
				fields: []
			}
		]
		const regionalView = resolveProfileCountryView('DE', query({ data: regionalData }))

		expect(profileInformationMetadata(baseProfile, regionalView)?.groups).toHaveLength(1)
		expect(profileInformationMetadata(baseProfile, { status: 'global' })).toBe(baseProfile.metadata)
		expect(profileInformationMetadata(baseProfile, { status: 'loading', country: 'DE' })).toBeNull()
		expect(
			profileInformationMetadata(baseProfile, resolveProfileCountryView('DE', query({ data: regional('unavailable') })))
		).toBeNull()
	})
})

describe('regional information presentation', () => {
	test('explains when the exchange is unavailable instead of leaving the Information panel empty', () => {
		const exchange = profile('binance', ['spot'])
		exchange.name = 'Binance'
		exchange.metadata.groups = [{ key: 'regulation', title: 'Regulation', fields: [] }]
		const html = renderToStaticMarkup(
			createElement(ExchangeRegionalInformation, {
				profile: exchange,
				asOfDate: '2026-07-22',
				view: {
					status: 'unavailable',
					country: 'US',
					regional: {
						country: 'US',
						region: { key: 'us', label: 'United States' },
						availability: 'unavailable',
						segments: [],
						note: 'Binance.com is blocked for US persons.',
						source: null,
						usedFallback: false,
						funding: null
					}
				}
			})
		)

		expect(html).toContain('Not available in United States')
		expect(html).toContain(
			'Country-specific information is not available because Binance is not offered in United States.'
		)
		expect(html).not.toContain('Binance.com is blocked for US persons.')
	})

	test('labels globally documented groups that have no country-specific details', () => {
		const exchange = profile('backpack', ['spot'])
		exchange.name = 'Backpack'
		exchange.metadata.groups = [{ key: 'regulation', title: 'Regulation', fields: [] }]
		const regionalMetadata = profile('backpack-us', []).metadata
		regionalMetadata.groups = [{ key: 'regulation', title: 'US regulation', fields: [] }]
		const html = renderToStaticMarkup(
			createElement(ExchangeRegionalInformation, {
				profile: exchange,
				asOfDate: '2026-07-22',
				view: {
					status: 'restricted',
					country: 'US',
					regional: {
						country: 'US',
						region: { key: 'us', label: 'United States' },
						availability: 'restricted',
						segments: ['spot'],
						note: 'Spot only.',
						source: null,
						usedFallback: false,
						funding: null,
						metadata: regionalMetadata
					}
				}
			})
		)

		expect(html).toContain('Deposits &amp; withdrawals')
		expect(html).toContain('Nothing United States-specific is published here.')
		expect(html).toContain('does not mean the feature is unavailable')
	})

	test('prompts for a country when global funding details are not published', () => {
		const exchange = profile('backpack', ['spot'])
		exchange.name = 'Backpack'
		exchange.metadata.groups = [{ key: 'regulation', title: 'Regulation', fields: [] }]
		const html = renderToStaticMarkup(
			createElement(ExchangeRegionalInformation, {
				profile: exchange,
				asOfDate: '2026-07-22',
				view: { status: 'global' }
			})
		)

		expect(html).toContain('Deposits &amp; withdrawals')
		expect(html).toContain('Select a country to view available deposit and withdrawal methods.')
	})

	test('does not add a funding fallback when the report publishes that section', () => {
		const exchange = profile('venue', ['spot'])
		exchange.metadata.groups = [
			{
				key: 'funding',
				title: 'Funding',
				fields: [{ key: 'sepa', label: 'SEPA deposits', type: 'text' as const, value: 'Free', comparable: true }]
			}
		]
		const html = renderToStaticMarkup(
			createElement(ExchangeRegionalInformation, {
				profile: exchange,
				asOfDate: '2026-07-22',
				view: { status: 'global' }
			})
		)

		expect(html).toContain('SEPA deposits')
		expect(html).not.toContain('Select a country to view available deposit and withdrawal methods.')
	})
})

describe('metadata-only profile presentation', () => {
	test('renders entity metadata without mounting history or markets UI', () => {
		const metadataOnly = profile('coinbase', [])
		metadataOnly.name = 'Coinbase'
		metadataOnly.profileMode = 'metadata-only'
		metadataOnly.metadata = {
			website: 'https://coinbase.example',
			referralUrl: null,
			twitterUrl: null,
			promotions: [
				{
					label: 'Offer',
					title: 'Coinbase promotion',
					subtitle: null,
					url: 'https://coinbase.example/offer',
					termsUrl: null,
					startsAt: null,
					endsAt: null,
					priority: null,
					sourceUrl: 'https://coinbase.example/source'
				}
			],
			kpis: [],
			groups: [
				{
					key: 'regulation',
					title: 'Regulation',
					fields: [{ key: 'status', label: 'Status', type: 'text' as const, value: 'Available', comparable: true }]
				}
			]
		}

		const html = renderToStaticMarkup(
			createElement(
				QueryClientProvider,
				{ client: new QueryClient() },
				createElement(ExchangeProfile, {
					profile: metadataOnly,
					asOfDate: '2026-07-15',
					loadSeries: () => {
						throw new Error('metadata-only profile requested history')
					}
				})
			)
		)

		expect(html).toContain('Coinbase promotion')
		expect(html).toContain('Regulation')
		expect(html).toContain('Report incorrect data')
		expect(html).not.toContain('History')
		expect(html).not.toContain('No market segments')
	})
})

describe('exchange history presentation', () => {
	test('shows aggregate totals and expandable hack and raise records', () => {
		const exchange = profile('venue', ['spot'])
		exchange.hacks = [
			{ date: 1_700_000_000, name: 'Venue', amountUsd: 2_000_000, technique: 'Hot wallet', returnedFundsUsd: 0 }
		]
		exchange.raises = [
			{
				date: 1_600_000_000,
				round: 'Series A',
				amountUsd: 10_000_000,
				valuationUsd: null,
				investors: [],
				sourceUrl: null
			}
		]

		const html = renderToStaticMarkup(createElement(ProfileHistory, { profile: exchange }))
		expect(html).toContain('Funds lost in recorded hacks')
		expect(html).toContain('$2m')
		expect(html).toContain('$10m')
		expect(html).toContain('Hot wallet')
		expect(html).toContain('Series A')
	})

	test('distinguishes no recorded hacks from hacks with an unknown loss amount', () => {
		const exchange = profile('venue', ['spot'])
		exchange.raises = [
			{
				date: 1_600_000_000,
				round: 'Series A',
				amountUsd: 10_000_000,
				valuationUsd: null,
				investors: [],
				sourceUrl: null
			}
		]

		const noHacksHtml = renderToStaticMarkup(createElement(ProfileHistory, { profile: exchange }))
		expect(noHacksHtml).toContain('No recorded hacks')
		expect(noHacksHtml).not.toContain('Amount unknown')

		exchange.hacks = [{ date: 1_700_000_000, name: 'Venue', amountUsd: null, technique: null, returnedFundsUsd: null }]
		const unknownAmountHtml = renderToStaticMarkup(createElement(ProfileHistory, { profile: exchange }))
		expect(unknownAmountHtml).toContain('Amount unknown')
		expect(unknownAmountHtml).not.toContain('No recorded hacks')
	})
})
