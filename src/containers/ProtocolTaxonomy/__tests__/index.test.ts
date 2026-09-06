import { describe, expect, test, vi } from 'vitest'

vi.mock('~/public/definitions', () => ({
	definitions: {
		dexs: {
			protocol: {
				'24h': '24h',
				'7d': '7d',
				'30d': '30d'
			}
		},
		perps: {
			protocol: {
				'24h': '24h',
				'7d': '7d',
				'30d': '30d'
			}
		},
		openInterest: { protocol: 'oi' },
		optionsPremium: { protocol: { '24h': '24h', '7d': '7d', '30d': '30d' } },
		optionsNotional: { protocol: { '24h': '24h', '7d': '7d', '30d': '30d' } },
		fees: { protocol: { '24h': '24h', '7d': '7d', '30d': '30d' }, chain: { '7d': '7d' } },
		revenue: { protocol: { '24h': '24h', '7d': '7d', '30d': '30d' }, chain: { '7d': '7d' } }
	}
}))

import { getColumnsForCategory, getProtocolMcapTvlRatio } from '../index'

const getHeader = (column: { header?: unknown }) => column.header

describe('getColumnsForCategory', () => {
	test('uses Spot Volume headers for Interface dex columns', () => {
		const headers = getColumnsForCategory('Interface').map(getHeader)
		expect(headers).toContain('Spot Volume 24h')
		expect(headers).toContain('Spot Volume 7d')
		expect(headers).toContain('Spot Volume 30d')
		expect(headers).toContain('Perp Volume 24h')
	})

	test('uses category-aware dex headers for prediction markets and crypto card issuers', () => {
		const predictionHeaders = getColumnsForCategory('Prediction Market').map(getHeader)
		expect(predictionHeaders).toContain('Prediction Volume 24h')
		expect(predictionHeaders).toContain('Prediction Volume 7d')
		expect(predictionHeaders).toContain('Prediction Volume 30d')

		const paymentHeaders = getColumnsForCategory('Crypto Card Issuer').map(getHeader)
		expect(paymentHeaders).toContain('Payment Volume 24h')
		expect(paymentHeaders).toContain('Payment Volume 7d')
		expect(paymentHeaders).toContain('Payment Volume 30d')
	})

	test('requires positive TVL for market-cap ratios while preserving zero market cap', () => {
		expect(getProtocolMcapTvlRatio(0, 10)).toBe(0)
		expect(getProtocolMcapTvlRatio(10, 0)).toBeUndefined()
		expect(getProtocolMcapTvlRatio(10, null)).toBeUndefined()
	})
})
