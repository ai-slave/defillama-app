import { describe, expect, test } from 'vitest'
import { getRwaPageHeadline, getRwaPageMeta, type RWAPageMeta } from '../pageCopy'
import type { RWAPageKind } from '../pageLayout'

describe('getRwaPageMeta', () => {
	test('every page keeps the title, description and canonical it had before', () => {
		const pages: Array<[RWAPageKind, { name: string; slug: string } | null, RWAPageMeta]> = [
			[
				'overview',
				null,
				{
					title: 'Real World Assets (RWA) Dashboard & Analytics - DefiLlama',
					description:
						'Track Real World Assets (RWA) tokenization on-chain. View tokenized treasuries, private credit, real estate, and commodities. RWA AUM, yields, and adoption analytics across all blockchains.',
					canonicalUrl: '/rwa'
				}
			],
			[
				'chain',
				{ name: 'Ethereum', slug: 'ethereum' },
				{
					title: 'Ethereum RWA Dashboard & Analytics - DefiLlama',
					description:
						'Track RWA adoption on Ethereum. Compare Active AUM, Onchain AUM, DeFi Active TVL, and utilization.',
					canonicalUrl: '/rwa/chain/ethereum'
				}
			],
			[
				'category',
				{ name: 'Treasuries', slug: 'treasuries' },
				{
					title: 'Treasuries RWA Dashboard & Analytics - DefiLlama',
					description:
						'Track Treasuries RWA assets onchain. Compare Active AUM, Onchain AUM, DeFi Active TVL, and utilization.',
					canonicalUrl: '/rwa/category/treasuries'
				}
			],
			[
				'assetGroup',
				{ name: 'Stocks', slug: 'stocks' },
				{
					title: 'Stocks RWA Dashboard & Analytics - DefiLlama',
					description:
						'Track Stocks RWA assets onchain. Compare Active AUM, Onchain AUM, DeFi Active TVL, and utilization.',
					canonicalUrl: '/rwa/asset-group/stocks'
				}
			],
			[
				'platform',
				{ name: 'Ondo', slug: 'ondo' },
				{
					title: 'Ondo RWA Dashboard & Analytics - DefiLlama',
					description:
						'Explore Ondo, an RWA platform enabling issuance, custody, trading, or management of tokenized real-world assets across blockchains.',
					canonicalUrl: '/rwa/platform/ondo'
				}
			],
			[
				'perpsOverview',
				null,
				{
					title: 'RWA Perps Dashboard & Analytics - DefiLlama',
					description:
						'Track RWA perpetual markets across venues. Compare open interest, 24h volume, market counts, and venue-level breakdowns.',
					canonicalUrl: '/rwa/perps'
				}
			],
			[
				'perpsAssetGroup',
				{ name: 'Stocks', slug: 'stocks' },
				{
					title: 'Stocks RWA Perps Dashboard & Analytics - DefiLlama',
					description:
						'Track Stocks RWA perpetual markets. Compare open interest, 24h volume, and venue-level activity.',
					canonicalUrl: '/rwa/perps/asset-group/stocks'
				}
			],
			[
				'perpsAsset',
				{ name: 'NVDA', slug: 'nvda' },
				{
					title: 'NVDA Perpetual Markets - DefiLlama',
					description:
						'Compare NVDA perpetual markets across venues by open interest, volume, funding, and market activity.',
					canonicalUrl: '/rwa/perps/asset/nvda'
				}
			],
			[
				'venue',
				{ name: 'trade[XYZ]', slug: 'trade-xyz' },
				{
					title: 'trade[XYZ] RWA Perps Dashboard & Analytics - DefiLlama',
					description:
						'Track trade[XYZ] RWA perpetual markets by open interest, volume, market activity, and instrument-level breakdowns.',
					canonicalUrl: '/rwa/perps/venue/trade-xyz'
				}
			]
		]
		for (const [kind, scope, meta] of pages) {
			expect({ kind, ...getRwaPageMeta(kind, scope) }).toEqual({ kind, ...meta })
		}
	})

	test('a platform page reads its description from the index when the index has one', () => {
		expect(getRwaPageMeta('platform', { name: 'Ondo', slug: 'ondo' }, 'Tokenized treasuries.').description).toBe(
			'Tokenized treasuries.'
		)
	})
})

describe('getRwaPageHeadline', () => {
	test('an overview or scope page heads with its metric, an entity page with its name', () => {
		expect(getRwaPageHeadline('overview', null)).toBe('Total RWA Active AUM')
		expect(getRwaPageHeadline('chain', 'Ethereum')).toBe('Ethereum RWA Active AUM')
		expect(getRwaPageHeadline('perpsOverview', null)).toBe('Total RWA Perps Open Interest')
		expect(getRwaPageHeadline('perpsAssetGroup', 'Stocks')).toBe('Stocks Perps Open Interest')
		expect(getRwaPageHeadline('perpsAsset', 'NVDA')).toBe('NVDA Perps Open Interest')
		expect(getRwaPageHeadline('platform', 'Ondo')).toBeNull()
		expect(getRwaPageHeadline('venue', 'QFEX')).toBeNull()
	})
})
