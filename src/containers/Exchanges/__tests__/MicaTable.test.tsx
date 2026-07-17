import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RampCostValue } from '../MicaCells'
import { buildMicaColumns } from '../micaColumns'
import { orderMicaVenues } from '../MicaTable'
import type { MicaVenueModel } from '../models'

function micaVenue(patch: Partial<MicaVenueModel> = {}): MicaVenueModel {
	return {
		exchange: 'venue',
		name: 'Venue',
		logoName: 'Venue',
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

describe('contractual Bybit EU placement', () => {
	it('pins bybit-eu to the first row while keeping the curated backend order otherwise', () => {
		const rows = [
			micaVenue({ exchange: 'coinbase-eu', name: 'Coinbase EU' }),
			micaVenue({ exchange: 'bybit-eu', name: 'Bybit EU' }),
			micaVenue({ exchange: 'okx-eu', name: 'OKX EU' }),
			micaVenue({ exchange: 'kraken-eu', name: 'Kraken EU' })
		]

		expect(orderMicaVenues(rows).map((row) => row.exchange)).toEqual(['bybit-eu', 'coinbase-eu', 'okx-eu', 'kraken-eu'])
	})
})

describe('mica table columns', () => {
	it('presents only the curated column set, in the legacy /mica order', () => {
		const columns = buildMicaColumns('2026-07-15')
		expect(columns.map((column) => column.id ?? (column as any).accessorKey)).toEqual([
			'name',
			'spotDepth2',
			'spotDepth05',
			'perpDepth2',
			'perpDepth05',
			'spotFee',
			'perpFee',
			'onRampCost',
			'offRampCost',
			'marketCount',
			'kyc',
			'profile'
		])

		const venue = micaVenue({ rampCost: RAMP_COST })
		expect((columns.find((column) => column.id === 'onRampCost') as any).accessorFn(venue, 0)).toBe(3.9)
		expect((columns.find((column) => column.id === 'offRampCost') as any).accessorFn(venue, 0)).toBe(4.9)
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
