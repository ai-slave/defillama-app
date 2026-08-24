import { flexRender } from '@tanstack/react-table'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RampCostValue } from '../MicaCells'
import { buildMicaColumns } from '../micaColumns'
import { micaColumnVisibility, orderMicaVenues } from '../MicaTable'
import type { ExchangePromotionModel, MicaVenueModel } from '../models'

function micaVenue(patch: Partial<MicaVenueModel> = {}): MicaVenueModel {
	return {
		exchange: 'venue',
		name: 'Venue',
		profileHref: '/exchange/venue',
		website: 'https://example.com',
		referralUrl: null,
		promotions: [],
		micaStatus: 'active',
		micaLicensed: true,
		micaMemberState: null,
		micaRegulator: null,
		licenseCount: 1,
		products: ['spot'],
		marketCount: 1,
		spotFee: null,
		perpFee: null,
		depth: {
			spotPartialCoverage: false,
			perpPartialCoverage: false,
			spotBid05Usd: null,
			spotAsk05Usd: null,
			spotBid2Usd: null,
			spotAsk2Usd: null,
			perpBid05Usd: null,
			perpAsk05Usd: null,
			perpBid2Usd: null,
			perpAsk2Usd: null
		},
		kyc: { required: true, short: 'ID', summary: 'Government ID' },
		fiatOnramp: false,
		rampCost: null,
		...patch
	}
}

const RAMP_COST: NonNullable<MicaVenueModel['rampCost']> = {
	notionalUsd: 1000,
	pair: 'BTC/EUR',
	onRamp: {
		fiatFeeUsd: 0,
		tradeFeeUsd: 1,
		slippageUsd: 0.5,
		transferFeeUsd: 2.4,
		totalUsd: 3.9,
		totalFraction: 0.0039
	},
	offRamp: {
		fiatFeeUsd: 1,
		tradeFeeUsd: 1,
		slippageUsd: 0.5,
		transferFeeUsd: 2.4,
		totalUsd: 4.9,
		totalFraction: 0.0049
	},
	assumptions: {
		method: 'sepa',
		takerFee: 0.001,
		halfSpreadFraction: 0.0005,
		btcWithdrawalFeeBtc: 0.00002,
		btcNetworkFeeBtc: 0.00002,
		btcPriceUsd: 120000
	}
}

const PROMOTION: ExchangePromotionModel = {
	label: '10% fee rebate',
	title: 'Venue launch offer',
	subtitle: 'Trade within 30 days. T&Cs apply.',
	url: 'https://example.com/promo',
	termsUrl: 'https://example.com/terms',
	startsAt: null,
	endsAt: null,
	priority: 1,
	sourceUrl: 'https://example.com/promo'
}

describe('contractual Bybit EU placement', () => {
	it('pins bybit-eu to the first row while keeping the curated backend order otherwise', () => {
		const rows = [
			micaVenue({ exchange: 'coinbase', name: 'Coinbase' }),
			micaVenue({ exchange: 'bybit-eu', name: 'Bybit EU' }),
			micaVenue({ exchange: 'okx-eu', name: 'OKX EU' }),
			micaVenue({ exchange: 'kraken', name: 'Kraken' })
		]

		expect(orderMicaVenues(rows).map((row) => row.exchange)).toEqual(['bybit-eu', 'coinbase', 'okx-eu', 'kraken'])
	})
})

describe('product column presets', () => {
	it('hides unrelated product columns while leaving them available for user overrides', () => {
		expect(micaColumnVisibility('all')).toEqual({ micaStatus: false, fiatOnramp: false })
		expect(micaColumnVisibility('spot')).toMatchObject({
			perpDepth2: false,
			perpDepth05: false,
			perpFee: false,
			onRampCost: false,
			offRampCost: false
		})
		expect(micaColumnVisibility('perp')).toMatchObject({
			spotDepth2: false,
			spotDepth05: false,
			spotFee: false,
			onRampCost: false,
			offRampCost: false
		})
		expect(micaColumnVisibility('fiat')).toMatchObject({
			spotDepth2: false,
			spotDepth05: false,
			perpDepth2: false,
			perpDepth05: false,
			spotFee: false,
			perpFee: false,
			marketCount: false
		})
	})
})

describe('mica table columns', () => {
	it('presents only the curated column set, in the legacy /mica order', () => {
		const columns = buildMicaColumns('2026-07-15')
		expect(columns.map((column) => column.id ?? (column as any).accessorKey)).toEqual([
			'name',
			'venueActions',
			'spotDepth2',
			'spotDepth05',
			'perpDepth2',
			'perpDepth05',
			'spotFee',
			'perpFee',
			'onRampCost',
			'offRampCost',
			'marketCount',
			'kyc'
		])

		const venue = micaVenue({ rampCost: RAMP_COST })
		expect((columns.find((column) => column.id === 'onRampCost') as any).accessorFn(venue, 0)).toBe(3.9)
		expect((columns.find((column) => column.id === 'offRampCost') as any).accessorFn(venue, 0)).toBe(4.9)
	})

	it('right-aligns the trade cell so the CTA lines up with or without a promo gift', () => {
		const tradeColumn = buildMicaColumns('2026-07-15').find((column) => column.id === 'venueActions')!
		expect((tradeColumn.meta as any).align).toBe('end')

		const plain = renderToStaticMarkup(flexRender(tradeColumn.cell, { row: { original: micaVenue() } } as never))
		const promoted = renderToStaticMarkup(
			flexRender(tradeColumn.cell, { row: { original: micaVenue({ promotions: [PROMOTION] }) } } as never)
		)

		expect(plain).toContain('justify-end')
		expect(promoted).toContain('justify-end')
		// The gift sits before the CTA, so only a right-aligned row keeps every Trade button on one edge.
		expect(promoted.indexOf('promotion')).toBeLessThan(promoted.indexOf('data-umami-event-placement="trade"'))
	})

	it('does not link exchange names to gated profile pages', () => {
		const nameColumn = buildMicaColumns('2026-07-15').find((column) => column.id === 'name')!
		const venue = micaVenue({ website: null, profileHref: '/exchange/venue' })
		const html = renderToStaticMarkup(flexRender(nameColumn.cell, { row: { original: venue } } as never))

		expect(html).toContain('Venue')
		expect(html).not.toContain('/exchange/venue')
		expect(html).not.toContain('<a')
	})

	it('keeps authored external exchange destinations', () => {
		const nameColumn = buildMicaColumns('2026-07-15').find((column) => column.id === 'name')!
		const venue = micaVenue({ website: 'https://example.com', profileHref: '/exchange/venue' })
		const html = renderToStaticMarkup(flexRender(nameColumn.cell, { row: { original: venue } } as never))

		expect(html).toContain('href="https://example.com"')
		expect(html).not.toContain('/exchange/venue')
	})
})

describe('€1k ramp cost cells', () => {
	it('renders an em-dash when ramp cost data is absent', () => {
		const html = renderToStaticMarkup(<RampCostValue row={micaVenue()} direction="onRamp" />)
		expect(html).toContain('–')
	})

	it('renders the euro total badge with an accessible breakdown trigger when populated', () => {
		const venue = micaVenue({ exchange: 'bybit-eu', name: 'Bybit EU', rampCost: RAMP_COST })

		const onRamp = renderToStaticMarkup(<RampCostValue row={venue} direction="onRamp" />)
		expect(onRamp).toContain('€3.90')
		expect(onRamp).toContain('aria-label="Bybit EU €1,000 on-ramp cost breakdown"')

		const offRamp = renderToStaticMarkup(<RampCostValue row={venue} direction="offRamp" />)
		expect(offRamp).toContain('€4.90')
		expect(offRamp).toContain('aria-label="Bybit EU €1,000 off-ramp cost breakdown"')
	})
})
