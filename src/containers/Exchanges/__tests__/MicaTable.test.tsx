import { flexRender } from '@tanstack/react-table'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { constructTestTable } from '~/components/Table/__tests__/helpers/constructTestTable'
import { searchTableFeatures as tableFeaturesConfig } from '~/components/Table/features/search'
import { RampCostValue } from '../MicaCells'
import { MICA_COLUMNS } from '../micaColumns'
import { prepareMicaVenues } from '../MicaTable'
import type { MicaVenueRowModel } from '../models'

function micaVenue(patch: Partial<MicaVenueRowModel> = {}): MicaVenueRowModel {
	return {
		exchange: 'venue',
		name: 'Venue',
		profileHref: '/exchange/venue',
		website: 'https://example.com',
		referralUrl: null,
		promotions: [],
		activePromotion: null,
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

const RAMP_COST: NonNullable<MicaVenueRowModel['rampCost']> = {
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
		btcPriceUsd: 120_000
	}
}

function micaCell(venue: MicaVenueRowModel, id: string) {
	const table = constructTestTable({
		features: tableFeaturesConfig,
		data: [venue],
		columns: MICA_COLUMNS,
		state: {},
		renderFallbackValue: null
	})
	const cell = table
		.getRowModel()
		.rows[0]?.getAllCells()
		.find((item) => item.column.id === id)
	if (!cell) throw new Error(`Expected ${id} cell`)
	return cell
}

function renderMicaCell(venue: MicaVenueRowModel, id: string) {
	const cell = micaCell(venue, id)
	return renderToStaticMarkup(flexRender(cell.column.columnDef.cell, cell.getContext()))
}

describe('contractual Bybit EU placement', () => {
	test('pins bybit-eu to the first row while keeping the curated backend order otherwise', () => {
		const rows = [
			micaVenue({ exchange: 'coinbase', name: 'Coinbase' }),
			micaVenue({ exchange: 'bybit-eu', name: 'Bybit EU' }),
			micaVenue({ exchange: 'okx-eu', name: 'OKX EU' }),
			micaVenue({ exchange: 'kraken', name: 'Kraken' })
		]

		expect(prepareMicaVenues(rows, 'all').map((row) => row.exchange)).toEqual([
			'bybit-eu',
			'coinbase',
			'okx-eu',
			'kraken'
		])
	})
})

describe('mica table columns', () => {
	test('sorts ramp costs by their numeric totals', () => {
		const venue = micaVenue({ rampCost: RAMP_COST })
		expect(micaCell(venue, 'onRampCost').getValue()).toBe(3.9)
		expect(micaCell(venue, 'offRampCost').getValue()).toBe(4.9)
	})

	test('keeps names without external destinations as plain text', () => {
		const venue = micaVenue({ website: null, profileHref: '/exchange/venue' })
		const html = renderMicaCell(venue, 'name')

		expect(html).toContain('Venue')
		expect(html).not.toContain('/exchange/venue')
		expect(html).not.toContain('<a')
	})

	test('links to the exchange profile independently of the external destination', () => {
		for (const website of [null, 'https://example.com']) {
			const html = renderMicaCell(micaVenue({ website }), 'profile')
			expect(html).toContain('href="/exchange/venue"')
			expect(html).toContain('aria-label="View Venue exchange profile"')
		}
	})

	test('keeps authored external exchange destinations', () => {
		const venue = micaVenue({
			website: 'https://example.com',
			profileHref: '/exchange/venue'
		})
		const html = renderMicaCell(venue, 'name')

		expect(html).toContain('href="https://example.com"')
		expect(html).not.toContain('/exchange/venue')
	})
})

describe('$1k ramp cost cells', () => {
	test('shows only a dash when the venue or the leg has no ramp cost', () => {
		const unpricedLeg = micaVenue({ rampCost: { ...RAMP_COST, onRamp: { ...RAMP_COST.onRamp, totalUsd: null } } })
		for (const venue of [micaVenue(), unpricedLeg]) {
			const html = renderToStaticMarkup(<RampCostValue row={venue} direction="onRamp" />)
			expect(html.replace(/<[^>]+>/g, '')).toBe('–')
		}
	})

	test('renders the USD total badge with an accessible breakdown trigger when populated', () => {
		const venue = micaVenue({
			exchange: 'bybit-eu',
			name: 'Bybit EU',
			rampCost: RAMP_COST
		})

		const onRamp = renderToStaticMarkup(<RampCostValue row={venue} direction="onRamp" />)
		// USD, not EUR: every rampCost field on the model is already USD. The EUR SEPA
		// rail is named in the step text, not in the amount's symbol.
		expect(onRamp).toContain('$3.90')
		expect(onRamp).toContain('aria-label="Bybit EU $1,000 on-ramp cost breakdown"')

		const offRamp = renderToStaticMarkup(<RampCostValue row={venue} direction="offRamp" />)
		expect(offRamp).toContain('$4.90')
		expect(offRamp).toContain('aria-label="Bybit EU $1,000 off-ramp cost breakdown"')
	})
})
