import { describe, expect, test } from 'vitest'
import type { CardsIndexResponse } from '../api.types'
import { groupCardRows, mapCardsIndex, VARIES_BY_TIER } from '../models'
import { cardTierRow } from './fixtures'

describe('groupCardRows', () => {
	test('groups tiers by card while preserving card and tier order', () => {
		const alphaStandard = cardTierRow('alpha', { tierName: 'Standard', tierCount: 2 })
		const beta = cardTierRow('beta')
		const alphaPremium = cardTierRow('alpha', { tierName: 'Premium', tierCount: 2 })

		const grouped = groupCardRows([alphaStandard, beta, alphaPremium])

		expect(grouped.map((row) => row.cardId)).toEqual(['alpha', 'beta'])
		expect(grouped[0]?.subRows?.map((row) => row.tierName)).toEqual(['Standard', 'Premium'])
		expect(grouped[1]).toMatchObject({ rowKind: 'card', cardId: 'beta' })
		expect(grouped[1]?.comparisonRows).toEqual([beta])
	})

	test('ranges comparable amounts only when their cadence matches', () => {
		const monthly = groupCardRows([
			cardTierRow('monthly', { annualFee: '$10/month' }),
			cardTierRow('monthly', { annualFee: '$30/mo' })
		])
		expect(monthly[0]?.annualFee).toBe('$10/month – $30/mo')
		for (const [first, second] of [
			['$10/day', '$100/month'],
			['$100/month', '$1,000/year'],
			['$10/day', '$1,000/year']
		] as const) {
			const mixedCadence = groupCardRows([
				cardTierRow('mixed', { annualFee: first }),
				cardTierRow('mixed', { annualFee: second })
			])
			expect(mixedCadence[0]?.annualFee).toBe(VARIES_BY_TIER)
		}
	})

	test('keeps unknown booleans distinct from tier disagreements', () => {
		const unknown = groupCardRows([cardTierRow('unknown'), cardTierRow('unknown')])
		const agreed = groupCardRows([cardTierRow('agreed', { applePay: true }), cardTierRow('agreed', { applePay: true })])
		const conflicting = groupCardRows([
			cardTierRow('conflicting', { applePay: true }),
			cardTierRow('conflicting', { applePay: false })
		])

		expect(unknown[0]?.applePay).toBe(null)
		expect(agreed[0]?.applePay).toBe(true)
		expect(conflicting[0]?.applePay).toBe(VARIES_BY_TIER)
	})

	test('unions list fields across tiers', () => {
		const grouped = groupCardRows([
			cardTierRow('union', { perks: ['Lounge access'], supportedCoins: ['USDC'] }),
			cardTierRow('union', { perks: ['Lounge access', 'Concierge'], supportedCoins: ['USDT'] })
		])

		expect(grouped[0]?.perks).toEqual(['Lounge access', 'Concierge'])
		expect(grouped[0]?.supportedCoins).toEqual(['USDC', 'USDT'])
	})

	test('unions tier countries and propagates unknown availability to the card', () => {
		const grouped = groupCardRows([
			cardTierRow('regional', {
				countryCodes: ['US'],
				countryCount: 1,
				availabilityUnknown: false
			}),
			cardTierRow('regional', {
				countryCodes: ['CA'],
				countryCount: 1,
				availabilityUnknown: true
			})
		])

		expect(grouped[0]).toMatchObject({
			countryCodes: ['US', 'CA'],
			countryCount: 2,
			availabilityUnknown: true
		})
	})

	test('groups cards under their parent protocol while keeping standalone cards at the root', () => {
		const grouped = groupCardRows([
			cardTierRow('coinbase-debit', { cardName: 'Coinbase Debit', parentId: 'coinbase' }),
			cardTierRow('solo'),
			cardTierRow('coinbase-one', { cardName: 'Coinbase One', parentId: 'coinbase' })
		])

		expect(grouped.map((row) => [row.rowKind, row.cardId, row.cardName])).toEqual([
			['parent', 'coinbase', 'Coinbase'],
			['card', 'solo', 'solo']
		])
		expect(grouped[0]?.subRows?.map((row) => [row.rowKind, row.cardId])).toEqual([
			['card', 'coinbase-debit'],
			['card', 'coinbase-one']
		])
	})

	test('keeps card tiers nested below cards in a parent protocol group', () => {
		const grouped = groupCardRows([
			cardTierRow('mexc-global', { cardName: 'MEXC Global Card', parentId: 'mexc', tierName: 'Standard' }),
			cardTierRow('mexc-global', { cardName: 'MEXC Global Card', parentId: 'mexc', tierName: 'Premium' }),
			cardTierRow('mexc-apac', { cardName: 'MEXC Card (APAC)', parentId: 'mexc' })
		])

		const parent = grouped[0]
		expect(parent?.cardName).toBe('MEXC')
		expect(parent?.comparisonRows).toHaveLength(3)
		expect(parent?.subRows?.[0]?.subRows?.map((row) => row.tierName)).toEqual(['Standard', 'Premium'])
	})
})

describe('mapCardsIndex', () => {
	test('maps the Pro API wire contract with tier-specific availability', () => {
		const response = {
			version: '2026-08-29',
			countries: { CA: 'Canada', US: 'United States' },
			reference: {
				coin_gecko_ids: { USDC: 'usd-coin' },
				defillama_chain_names: { Ethereum: 'Ethereum' }
			},
			facets: {
				countries: { US: 1 },
				networks: { visa: 1 },
				classes: { debit: 1 },
				custody: { 'self-custodial': 1 },
				chains: { Ethereum: 1 },
				coins: { USDC: 1 },
				forms: { virtual: 1 },
				perks: { lounge: 1 },
				access: { gated: 1 }
			},
			cards: [
				{
					id: 'example-card',
					name: 'Example Card',
					parent_id: 'example',
					logo: 'https://example.com/logo.png',
					url: 'https://example.com',
					as_of: '2026-08-29',
					availability: 'not_publicly_disclosed',
					data_status: 'refreshed',
					countries: ['CA', 'US'],
					roll: {
						annual_fee_min: { amount_minor: 0, minor_exponent: 2, currencies: [] },
						networks: ['visa'],
						classes: ['debit'],
						has_confirmed_ungated_tier: false
					},
					tiers: [
						{
							id: 'example-card--metal',
							name: 'Metal',
							region: 'United States',
							availability: 'confirmed',
							access: 'gated',
							countries: ['US'],
							gate: {
								mode: 'any',
								options: [{ kind: 'volume', label: '$199/year', period: 'year' }]
							},
							cashback: {
								label: '1.5%',
								payout_asset: 'USDC',
								payout_cap: { amount_minor: 12_345, minor_exponent: 2, currencies: ['USD'] },
								payout_cap_period: 'month'
							},
							fees: { annual_label: '$199/year', fx_bps: 120, fx_label: '1.2%' },
							type: { class: 'debit', network: 'visa', forms: ['virtual'], issuer: 'Example Bank' },
							crypto: { chains: ['Ethereum'], coins: ['USDC'], custody: 'self-custodial' },
							integrations: { apple_pay: 1, iban: 0 },
							atm: { label: '$500/month', withdrawal_fee_bps: 120, free_withdrawal_period: 'month' },
							limits: { daily_label: '$1,000/day', monthly_label: '$10,000/month' },
							perks: [{ code: 'lounge', label: 'Lounge access', status: 'coming_soon' }]
						}
					]
				}
			]
		} satisfies CardsIndexResponse

		expect(mapCardsIndex(response)).toEqual({
			rows: [
				{
					rowKind: 'tier',
					cardId: 'example-card',
					cardName: 'Example Card',
					parentId: 'example',
					logo: 'https://example.com/logo.png',
					url: 'https://example.com',
					countryCodes: ['US'],
					countryCount: 1,
					availabilityUnknown: false,
					tierCount: 1,
					tierId: 'example-card--metal',
					tierName: 'Metal',
					region: 'United States',
					cashbackRate: '1.5%',
					cashbackCurrency: 'USDC',
					maxCashbackPerMonth: '$123.45/month',
					perks: ['Lounge access (coming soon)'],
					annualFee: '$199/year',
					fxFee: '1.2%',
					access: '$199/year',
					supportedChains: ['Ethereum'],
					supportedCoins: ['USDC'],
					custodyType: 'self-custodial',
					cardClassification: 'debit',
					network: 'visa',
					virtualPhysical: 'Virtual',
					issuer: 'Example Bank',
					virtual: true,
					physical: null,
					applePay: true,
					googlePay: null,
					iban: false,
					atmFee: '1.2%',
					atmAllowance: '$500/month',
					dailySpendingLimit: '$1,000/day',
					monthlySpendingLimit: '$10,000/month'
				}
			],
			reference: {
				coinGeckoIds: { USDC: 'usd-coin' },
				chainNames: { Ethereum: 'Ethereum' }
			}
		})

		const responseWithoutLogo = structuredClone(response)
		responseWithoutLogo.cards[0].logo = undefined
		expect(mapCardsIndex(responseWithoutLogo).rows[0]?.logo).toBe(
			'https://icons.llamao.fi/icons/crypto-cards/example-card?w=48&h=48'
		)
	})
})
