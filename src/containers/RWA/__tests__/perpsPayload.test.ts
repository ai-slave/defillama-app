import { describe, expect, test } from 'vitest'
import type { IRWAPerpsMarket } from '../Perps/api.types'
import { toRWAPerpsContractOverlayRow } from '../perpsOverlay'
import { packRwaPerpsMarkets, unpackRwaPerpsMarkets } from '../perpsPayload'

const market = {
	id: 'xyz:TSLA',
	timestamp: 1_760_000_000,
	contract: 'xyz:TSLA',
	venue: 'trade[XYZ]',
	venueType: 'DEX',
	openInterest: 5_000_000,
	openInterestChange24h: null,
	volume24h: 1_000_000,
	volume24hChange24h: -10,
	price: 430,
	priceChange24h: 1.5,
	fundingRate: 0.00001,
	fundingIntervalHours: 1,
	premium: null,
	cumulativeFunding: 12,
	oraclePx: 429,
	midPx: 430.5,
	prevDayPx: 425,
	referenceAsset: 'Tesla',
	referenceAssetGroup: 'Equities',
	assetClass: ['Stock Perp'],
	parentPlatform: 'trade[XYZ]',
	category: ['RWA Perps'],
	issuer: null,
	accessModel: 'Permissionless',
	rwaClassification: 'RWA Perp',
	pair: 'TSLA/USDC',
	marginAsset: 'USDC',
	settlementAsset: 'USDC',
	szDecimals: 3,
	makerFeeRate: 0.0001,
	takerFeeRate: 0.00035,
	deployerFeeShare: 0.5,
	oracleProvider: 'Pyth',
	link: 'https://app.trade.xyz/TSLA',
	website: ['https://trade.xyz'],
	description: 'Tesla perpetual',
	maxLeverage: 10,
	volume7d: 7_000_000,
	volume30d: 30_000_000,
	volumeAllTime: 90_000_000,
	estimatedProtocolFees24h: 400,
	estimatedProtocolFees7d: 2800,
	estimatedProtocolFees30d: 12_000,
	estimatedProtocolFeesAllTime: 36_000,
	suspicious: false
} as unknown as IRWAPerpsMarket

const otherMarket = {
	...market,
	id: 'binance:TSLAUSDT',
	contract: 'binance:TSLAUSDT',
	venue: 'Binance',
	venueType: 'CEX',
	parentPlatform: 'Binance',
	openInterest: 9_000_000,
	description: null,
	website: null
} as unknown as IRWAPerpsMarket

const fullRows = [toRWAPerpsContractOverlayRow(market), toRWAPerpsContractOverlayRow(otherMarket)]

describe('packRwaPerpsMarkets', () => {
	test('every field of a market row survives the round trip, the picker extras and the csv-only fields included', () => {
		expect(unpackRwaPerpsMarkets(packRwaPerpsMarkets(fullRows))).toEqual(fullRows)
	})

	test('a market whose id differs from its contract keeps its own id', () => {
		const row = toRWAPerpsContractOverlayRow({ ...market, id: 'xyz:TSLA:1' } as IRWAPerpsMarket)
		expect(unpackRwaPerpsMarkets(packRwaPerpsMarkets([row]))[0]).toMatchObject({
			id: 'xyz:TSLA:1',
			contract: 'xyz:TSLA'
		})
	})

	test('numbers travel with six significant digits and whole dollars kept', () => {
		const row = toRWAPerpsContractOverlayRow({
			...market,
			priceChange24h: 3.71726083208562,
			openInterest: 694_823_746.00712,
			fundingRate: 0.0000062512345,
			maxLeverage: 3.0003000300030003
		} as IRWAPerpsMarket)
		expect(unpackRwaPerpsMarkets(packRwaPerpsMarkets([row]))[0]).toMatchObject({
			priceChange24h: 3.71726,
			openInterest: 694_823_746,
			fundingRate: 0.00000625123,
			maxLeverage: 3.0003
		})
	})

	test('a repeated text value and every key name travel once', () => {
		const rows = Array.from({ length: 10 }, (_, index) =>
			toRWAPerpsContractOverlayRow({ ...market, id: `m${index}`, contract: `m${index}` } as IRWAPerpsMarket)
		)
		const json = JSON.stringify(packRwaPerpsMarkets(rows))
		expect(json.split('Permissionless').length - 1).toBe(1)
		expect(json.split('"openInterest"').length - 1).toBe(1)
	})
})
