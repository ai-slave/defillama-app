import { describe, expect, it } from 'vitest'
import { parseHyperliquidWsMessage } from './api'

describe('Hyperliquid websocket wire contracts', () => {
	it('accepts each audited channel payload', () => {
		expect(parseHyperliquidWsMessage({ channel: 'allMids', data: { mids: { BTC: '65000.5' } } })).toEqual({
			channel: 'allMids',
			data: { mids: { BTC: '65000.5' } },
			isSnapshot: undefined
		})
		expect(
			parseHyperliquidWsMessage({
				channel: 'trades',
				data: [{ coin: 'ETH', side: 'B', px: '3500', sz: '2.5', time: 1_784_332_800_000, tid: 42 }]
			})
		).toMatchObject({ channel: 'trades', data: [{ coin: 'ETH', time: 1_784_332_800_000 }] })
		expect(
			parseHyperliquidWsMessage({
				channel: 'l2Book',
				data: {
					coin: 'BTC',
					time: 1_784_332_800_000,
					levels: [[{ px: '65000', sz: '1', n: 2 }], [{ px: '65001', sz: '3', n: 1 }]]
				}
			})
		).toMatchObject({ channel: 'l2Book', data: { coin: 'BTC', time: 1_784_332_800_000 } })
	})

	it('rejects unknown channels and payloads that do not match their discriminator', () => {
		expect(parseHyperliquidWsMessage({ channel: 'trades', data: { mids: { BTC: '1' } } })).toBeNull()
		expect(
			parseHyperliquidWsMessage({
				channel: 'l2Book',
				data: { coin: 'BTC', time: '1784332800000', levels: [[], []] }
			})
		).toBeNull()
		expect(parseHyperliquidWsMessage({ channel: 'subscriptionResponse', data: {} })).toBeNull()
	})
})
