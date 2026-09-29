import { describe, expect, test } from 'vitest'
import type { CardsDetailTier, CardsTier } from '../api.types'
import { type CardDetailGroup, cardSummaryRows, tierDetailGroups } from '../detailRows'
import { cardsIndexCard } from './fixtures'

const baseTier: CardsTier = {
	id: 'kast--standard',
	name: 'Standard',
	region: 'Global',
	availability: 'confirmed',
	access: 'ungated',
	fees: {},
	type: {},
	crypto: {},
	integrations: {},
	atm: {},
	limits: {}
}

const baseDetail: CardsDetailTier = { id: 'kast--standard', other_fees: [], card_issue: [], disclosure: {} }

function rowByLabel(groups: Array<CardDetailGroup>, label: string) {
	return groups.flatMap((group) => group.rows).find((row) => row.label === label)
}

describe('tierDetailGroups', () => {
	test('shows stated values and hides fields the API does not track', () => {
		const groups = tierDetailGroups({ ...baseTier, cashback: { label: '2%' } }, baseDetail, [], {})

		expect(rowByLabel(groups, 'Cashback')).toEqual({ label: 'Cashback', value: '2%', muted: false })
		expect(rowByLabel(groups, 'Promotional cashback')).toBeUndefined()
	})

	test('says None when the issuer states there is no value', () => {
		const detail = { ...baseDetail, disclosure: { annual_fee: { status: 'explicitly_none' as const } } }

		expect(rowByLabel(tierDetailGroups(baseTier, detail, [], {}), 'Annual fee')).toEqual({
			label: 'Annual fee',
			value: 'None',
			muted: false
		})
	})

	test('marks a field the issuer does not publish as not publicly disclosed', () => {
		const detail = { ...baseDetail, disclosure: { signup_bonus: { status: 'not_publicly_disclosed' as const } } }

		expect(rowByLabel(tierDetailGroups(baseTier, detail, [], {}), 'Signup bonus')).toEqual({
			label: 'Signup bonus',
			value: 'Not publicly disclosed',
			muted: true
		})
	})

	test('marks undisclosed availability and requirements as not publicly disclosed', () => {
		const tier: CardsTier = { ...baseTier, availability: 'not_publicly_disclosed', access: 'not_publicly_disclosed' }
		const groups = tierDetailGroups(tier, baseDetail, [], {})

		expect(rowByLabel(groups, 'Availability')).toEqual({
			label: 'Availability',
			value: 'Not publicly disclosed',
			muted: true
		})
		expect(rowByLabel(groups, 'Requirements')).toEqual({
			label: 'Requirements',
			value: 'Not publicly disclosed',
			muted: true
		})
	})

	test('drops a section whose fields are all hidden', () => {
		const groups = tierDetailGroups(baseTier, baseDetail, [], {})

		expect(groups).toEqual([
			{
				title: 'Eligibility and availability',
				rows: [
					{ label: 'Availability', value: 'Confirmed', muted: false },
					{ label: 'Requirements', value: 'None', muted: false }
				]
			}
		])
	})

	test('names every currency an amount is payable in', () => {
		const tier: CardsTier = {
			...baseTier,
			cashback: {
				label: '3%',
				payout_cap: { amount_minor: 1000, minor_exponent: 2, currencies: ['EURe', 'GBPe', 'USD'] },
				payout_cap_period: 'month'
			}
		}

		expect(rowByLabel(tierDetailGroups(tier, baseDetail, [], {}), 'Payout cap')?.value).toBe(
			'10 EURe / 10 GBPe / $10 per month'
		)
	})

	test('spells out spend-banded cashback in order', () => {
		const tier: CardsTier = {
			...baseTier,
			cashback: {
				label: 'Up to 2%',
				bands: [
					{
						rate_bps: 200,
						cumulative_spend: { amount_minor: 500_000, minor_exponent: 2, currencies: ['USD'] },
						period: 'month'
					},
					{ rate_bps: 100 }
				]
			}
		}

		expect(rowByLabel(tierDetailGroups(tier, baseDetail, [], {}), 'Cashback bands')?.value).toBe(
			'2% through $5,000 per month cumulative spend; 1%'
		)
	})
})

describe('cardSummaryRows', () => {
	test('reads an annual fee sent without a currency as None', () => {
		const card = cardsIndexCard('kast')
		card.roll.annual_fee_min = { amount_minor: 0, minor_exponent: 2, currencies: [] }

		expect(cardSummaryRows(card, {}).find((row) => row.label === 'Minimum annual fee')?.value).toBe('None')
	})

	test('marks undisclosed card availability as not publicly disclosed', () => {
		const card = cardsIndexCard('kast')
		card.availability = 'not_publicly_disclosed'

		expect(cardSummaryRows(card, {}).find((row) => row.label === 'Availability')).toEqual({
			label: 'Availability',
			value: 'Not publicly disclosed',
			muted: true
		})
	})

	test('shows one rate when base and maximum cashback match', () => {
		const card = cardsIndexCard('kast')
		card.roll.cashback_base_bps = 300
		card.roll.cashback_max_bps = 300

		expect(cardSummaryRows(card, {}).find((row) => row.label === 'Cashback range')?.value).toBe('3%')
	})
})
