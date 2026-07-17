import { describe, expect, it } from 'vitest'
import { CEXS_PAGE_METADATA } from '~/pages/cexs'
import { EXCHANGES_PAGE_METADATA } from '~/pages/exchanges'
import { EXCHANGE_RESEARCH_PAGE_METADATA } from '~/pages/exchanges/charts'
import { MICA_PAGE_METADATA } from '~/pages/mica'

describe('Exchanges page metadata', () => {
	it('uses the shared Exchanges product breadcrumb with route-specific identity', () => {
		expect([
			EXCHANGES_PAGE_METADATA.pageName,
			CEXS_PAGE_METADATA.pageName,
			EXCHANGE_RESEARCH_PAGE_METADATA.pageName,
			MICA_PAGE_METADATA.pageName
		]).toEqual([['Exchanges'], ['Exchanges'], ['Exchanges'], ['Exchanges']])

		expect(EXCHANGES_PAGE_METADATA).toMatchObject({
			title: 'Crypto Exchange Volume, Liquidity and Transparency - DefiLlama',
			canonicalUrl: '/exchanges'
		})
		expect(EXCHANGE_RESEARCH_PAGE_METADATA).toMatchObject({
			title: 'Exchange Research Charts - DefiLlama',
			canonicalUrl: '/exchanges/charts'
		})
		expect(CEXS_PAGE_METADATA).toMatchObject({
			title: 'Crypto Exchange Reserves and Inflows - DefiLlama',
			canonicalUrl: '/cexs'
		})
		expect(MICA_PAGE_METADATA).toMatchObject({
			title: 'MiCA-regulated exchanges - DefiLlama',
			canonicalUrl: '/mica'
		})
	})
})
