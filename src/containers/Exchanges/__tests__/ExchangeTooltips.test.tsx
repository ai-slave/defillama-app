import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { EuAvailabilityValue } from '../ComplianceCells'
import { MicaDepthValue } from '../MicaCells'
import type { ExchangeEeaOrderbookOwnership, MicaVenueModel } from '../models'

vi.mock('~/ui/Tooltip', () => ({
	Tooltip: ({ content, children }: { content: ReactNode; children: ReactNode }) => (
		<span data-tooltip="true">
			<span>{content}</span>
			{children}
		</span>
	)
}))

function micaVenue(): MicaVenueModel {
	return {
		exchange: 'venue',
		name: 'Venue',
		profileHref: '/exchange/venue',
		website: null,
		referralUrl: null,
		promotions: [],
		micaStatus: 'active',
		micaLicensed: true,
		micaMemberState: null,
		micaRegulator: null,
		licenseCount: 1,
		products: ['spot', 'linear_perp'],
		marketCount: 2,
		spotFee: null,
		perpFee: null,
		depth: {
			spotPartialCoverage: false,
			perpPartialCoverage: true,
			spotBid05Usd: null,
			spotAsk05Usd: null,
			spotBid2Usd: 3,
			spotAsk2Usd: 4,
			perpBid05Usd: null,
			perpAsk05Usd: null,
			perpBid2Usd: 5,
			perpAsk2Usd: 6
		},
		kyc: null,
		fiatOnramp: false,
		rampCost: null
	}
}

describe('exchange compliance and depth tooltips', () => {
	it.each<[ExchangeEeaOrderbookOwnership, string]>([
		[{ mode: 'own' }, 'Uses dedicated regional orderbooks.'],
		[{ mode: 'shared' }, 'Shares the global orderbook.'],
		[
			{ mode: 'mixed', sharedSegments: ['spot'], dedicatedSegments: ['linear_perp'] },
			'Shared: Spot. Dedicated: USD Perps.'
		]
	])('renders %s EEA ownership details', (eeaOrderbookOwnership, expected) => {
		const html = renderToStaticMarkup(
			<EuAvailabilityValue status="available" eeaOrderbookOwnership={eeaOrderbookOwnership} />
		)

		expect(html).toContain(expected)
	})

	it('uses only the selected segment partial-coverage flag', () => {
		const venue = micaVenue()
		const spot = renderToStaticMarkup(
			<MicaDepthValue row={venue} product="spot" value={7} bid={3} ask={4} helperText="Spot helper" />
		)
		const linear = renderToStaticMarkup(
			<MicaDepthValue row={venue} product="perp" value={11} bid={5} ask={6} helperText="Perp helper" />
		)

		expect(spot).not.toContain('Partial coverage')
		expect(linear).toContain('Partial coverage')

		venue.depth.spotPartialCoverage = true
		venue.depth.perpPartialCoverage = false
		const partialSpot = renderToStaticMarkup(
			<MicaDepthValue row={venue} product="spot" value={7} bid={3} ask={4} helperText="Spot helper" />
		)
		const completeLinear = renderToStaticMarkup(
			<MicaDepthValue row={venue} product="perp" value={11} bid={5} ask={6} helperText="Perp helper" />
		)
		expect(partialSpot).toContain('Partial coverage')
		expect(completeLinear).not.toContain('Partial coverage')
	})

	it('renders linear depth as inapplicable for an inverse-only venue', () => {
		const venue = micaVenue()
		venue.products = ['inverse_perp']

		const html = renderToStaticMarkup(
			<MicaDepthValue row={venue} product="perp" value={11} bid={5} ask={6} helperText="Perp helper" />
		)

		expect(html).toContain('N/A')
		expect(html).not.toContain('Partial coverage')
	})
})
