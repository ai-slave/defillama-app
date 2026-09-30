import { describe, expect, test } from 'vitest'
import type { CardsDetailFee, CardsDetailTier, CardsTier } from '../api.types'
import { type CardDetailSection, cardKeyFacts, compareTiers, tierDetailSections } from '../detailRows'
import { cardsIndexCard } from './fixtures'

const baseTier: CardsTier = {
	id: 'kast--standard',
	name: 'Standard',
	region: 'Global',
	region_type: 'global',
	availability: 'confirmed',
	access: 'ungated',
	cashback_status: 'not_publicly_disclosed',
	fees: {},
	type: {},
	crypto: {},
	integrations: {},
	atm: { fee_status: 'not_publicly_disclosed' },
	limits: {}
}

const baseDetail: CardsDetailTier = { id: 'kast--standard', other_fees: [], card_issue: [], disclosure: {} }

function fieldValue(sections: Array<CardDetailSection>, label: string) {
	return sections.flatMap((section) => section.fields).find((field) => field.label === label)?.value
}

function fee(label: string, extra: Partial<CardsDetailFee> = {}): CardsDetailFee {
	return { label, kind: 'other', ...extra }
}

function feeSection(detail: CardsDetailTier, tier: CardsTier = baseTier) {
	return tierDetailSections(tier, detail, [], {}).find((section) => section.title === 'Fees and ATM access')
}

describe('tierDetailSections', () => {
	test('shows stated values and hides fields the API does not track', () => {
		const sections = tierDetailSections({ ...baseTier, cashback: { label: '2%' } }, baseDetail, [], {})

		expect(fieldValue(sections, 'Cashback')).toEqual({ kind: 'text', text: '2%' })
		expect(fieldValue(sections, 'Promotional cashback')).toBeUndefined()
	})

	test('says None when the issuer states there is no value', () => {
		const detail = { ...baseDetail, disclosure: { annual_fee: { status: 'explicitly_none' as const } } }

		expect(fieldValue(tierDetailSections(baseTier, detail, [], {}), 'Annual fee')).toEqual({
			kind: 'text',
			text: 'None'
		})
	})

	test('marks fields the issuer does not publish, including availability and requirements', () => {
		const tier: CardsTier = { ...baseTier, availability: 'not_publicly_disclosed', access: 'not_publicly_disclosed' }
		const detail = { ...baseDetail, disclosure: { signup_bonus: { status: 'not_publicly_disclosed' as const } } }
		const sections = tierDetailSections(tier, detail, [], {})

		expect(fieldValue(sections, 'Signup bonus')).toEqual({ kind: 'undisclosed' })
		expect(fieldValue(sections, 'Countries')).toEqual({ kind: 'undisclosed' })
		expect(fieldValue(sections, 'Requirements')).toEqual({ kind: 'undisclosed' })
	})

	test('lists countries, perks, chains, and coins as separate items', () => {
		const tier: CardsTier = {
			...baseTier,
			perks: [
				{ code: 'lounge', label: 'Airport lounge access', status: 'available' },
				{ code: 'metal', label: 'Metal card', status: 'coming_soon' }
			],
			crypto: { chains: ['arbitrum', 'ethereum'], coins: ['USDC', 'USDT'] }
		}
		const sections = tierDetailSections(tier, baseDetail, ['AE', 'US'], { AE: 'United Arab Emirates' })

		expect(fieldValue(sections, 'Countries')).toEqual({
			kind: 'list',
			items: ['United Arab Emirates', 'United States']
		})
		expect(fieldValue(sections, 'Perks')).toEqual({
			kind: 'list',
			items: ['Airport lounge access', 'Metal card (coming soon)']
		})
		expect(fieldValue(sections, 'Supported chains')).toEqual({ kind: 'list', items: ['Arbitrum', 'Ethereum'] })
		expect(fieldValue(sections, 'Supported coins')).toEqual({ kind: 'list', items: ['USDC', 'USDT'] })
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

		expect(fieldValue(tierDetailSections(tier, baseDetail, [], {}), 'Payout cap')).toEqual({
			kind: 'text',
			text: '10 EURe / 10 GBPe / $10 per month'
		})
	})

	test('spells out spend-banded cashback one band per line, in order', () => {
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

		expect(fieldValue(tierDetailSections(tier, baseDetail, [], {}), 'Cashback bands')).toEqual({
			kind: 'notes',
			items: ['2% through $5,000 per month cumulative spend', '1%']
		})
	})
})

describe('rate rows the issuer text already states', () => {
	function rewardLabels(tier: Partial<CardsTier>) {
		return tierDetailSections({ ...baseTier, ...tier }, baseDetail, [], {})
			.find((section) => section.title === 'Rewards and perks')
			?.fields.map((field) => field.label)
	}

	test('shows spend-banded cashback once when its text already names every rate', () => {
		const usd = (dollars: number) => ({ amount_minor: dollars * 100, minor_exponent: 2, currencies: ['USD'] })
		const cashback = {
			label: '4% first $2,500/month; 1% next $1,500; 0% thereafter',
			base_bps: 400,
			max_bps: 400,
			bands: [
				{ rate_bps: 400, cumulative_spend: usd(2500), period: 'month' },
				{ rate_bps: 100, cumulative_spend: usd(4000) },
				{ rate_bps: 0 }
			]
		}

		expect(rewardLabels({ cashback })).toEqual(['Cashback'])
	})

	test('keeps a base rate the cashback text does not name', () => {
		expect(rewardLabels({ cashback: { label: 'Up to 6%', base_bps: 100, max_bps: 600 } })).toEqual([
			'Cashback',
			'Base cashback'
		])
	})

	test('leaves out an ATM fee the ATM terms already state, and keeps one they do not', () => {
		const atmLabels = (label: string) =>
			feeSection(baseDetail, {
				...baseTier,
				atm: { fee_status: 'confirmed', label, withdrawal_fee_bps: 65 }
			})?.fields.map((field) => field.label)

		expect(atmLabels('$1.00 + 0.65% per withdrawal')).toEqual(['ATM terms'])
		expect(atmLabels('$250/day; maximum 3 withdrawals/day')).toEqual(['ATM terms', 'ATM withdrawal fee'])
	})
})

describe('fee fields', () => {
	test('gives every fee its own field, splitting labels that pack several fees', () => {
		const detail = {
			...baseDetail,
			other_fees: [
				fee('Card shipping: $0'),
				fee('Late Payment: Up to 2% of the current outstanding card balance; Over the Credit Line: None'),
				fee('Priority international delivery: $50; tracked; 1-2 weeks')
			]
		}

		expect(feeSection(detail)?.fields).toEqual([
			{ label: 'Card shipping', value: { kind: 'text', text: '$0' } },
			{ label: 'Late Payment', value: { kind: 'text', text: 'Up to 2% of the current outstanding card balance' } },
			{ label: 'Over the Credit Line', value: { kind: 'text', text: 'None' } },
			{ label: 'Priority international delivery', value: { kind: 'text', text: '$50; tracked; 1-2 weeks' } }
		])
	})

	test('shows a fee listed twice with different casing or wording once, as first stated', () => {
		const detail = {
			...baseDetail,
			card_issue: [fee('Card shipping: $0', { kind: 'shipping' })],
			other_fees: [
				fee('Late payment: up to 2% of outstanding balance; Card Shipping: $0'),
				fee('Late Payment: Up to 2% of the current outstanding card balance')
			]
		}

		expect(feeSection(detail)?.fields).toEqual([
			{ label: 'Card shipping', value: { kind: 'text', text: '$0' } },
			{ label: 'Late payment', value: { kind: 'text', text: 'Up to 2% of outstanding balance' } }
		])
	})

	test('keeps a listed fee out when the page already shows that field', () => {
		const tier: CardsTier = { ...baseTier, fees: { annual_label: '$20/year' } }
		const detail = { ...baseDetail, other_fees: [fee('Annual fee: $20'), fee('Card replacement: $10')] }

		expect(feeSection(detail, tier)?.fields.map((field) => field.label)).toEqual(['Annual fee', 'Card replacement'])
		expect(fieldValue(tierDetailSections(tier, detail, [], {}), 'Annual fee')).toEqual({
			kind: 'text',
			text: '$20/year'
		})
	})

	test('collects fee terms that have no name as sentences', () => {
		const detail = {
			...baseDetail,
			other_fees: [fee('returned payment fee of US$35.00'), fee('Returned payment fee of US$35.00'), fee('Top-up: 0%')]
		}

		expect(feeSection(detail)?.fields).toEqual([
			{ label: 'Top-up', value: { kind: 'text', text: '0%' } },
			{ label: 'Other fee terms', value: { kind: 'notes', items: ['returned payment fee of US$35.00'] } }
		])
	})

	test('starts every fee amount with a capital letter', () => {
		const detail = {
			...baseDetail,
			other_fees: [fee('Returned payment: none'), fee('Standard delivery: free; untracked; 3-4 weeks')]
		}

		expect(feeSection(detail)?.fields).toEqual([
			{ label: 'Returned payment', value: { kind: 'text', text: 'None' } },
			{ label: 'Standard delivery', value: { kind: 'text', text: 'Free; untracked; 3-4 weeks' } }
		])
	})

	test('shows a fee once when a second mention only adds an explanation to its name', () => {
		const detail = {
			...baseDetail,
			other_fees: [fee('Cross-Border Fee (transactions with foreign merchants) | None'), fee('Cross-Border Fee | None')]
		}

		expect(feeSection(detail)?.fields).toEqual([
			{ label: 'Cross-Border Fee (transactions with foreign merchants)', value: { kind: 'text', text: 'None' } }
		])
	})

	test('names the card form a form-specific fee applies to, keeping one fee per form', () => {
		const detail = {
			...baseDetail,
			card_issue: [
				fee('Issuance: $10', { kind: 'issuance', form_factor: 'physical' }),
				fee('Issuance: $5', { kind: 'issuance', form_factor: 'virtual' })
			]
		}

		expect(feeSection(detail)?.fields).toEqual([
			{ label: 'Issuance (physical)', value: { kind: 'text', text: '$10' } },
			{ label: 'Issuance (virtual)', value: { kind: 'text', text: '$5' } }
		])
	})
})

describe('compareTiers', () => {
	// Tiers go through tierDetailSections, the writer the page feeds compareTiers from.
	function compare(...tiers: Array<[Partial<CardsTier>, Partial<CardsDetailTier>?]>) {
		return compareTiers(
			tiers.map(([tier, detail]) => tierDetailSections({ ...baseTier, ...tier }, { ...baseDetail, ...detail }, [], {}))
		)
	}

	test('shows shared values once and lines tiers up only where they differ', () => {
		const comparison = compare(
			[{ name: 'Platinum', fees: { annual_label: 'None' } }, { kyc: 'KYC required' }],
			[
				{
					name: 'Signature',
					fees: { annual_label: '$20/year' },
					atm: { fee_status: 'not_publicly_disclosed', label: '$250/day' }
				},
				{ kyc: 'KYC required' }
			]
		)

		expect(comparison).toEqual({
			shared: [
				{
					title: 'Eligibility and availability',
					fields: [
						{ label: 'Requirements', value: { kind: 'text', text: 'None' } },
						{ label: 'KYC / credit check', value: { kind: 'text', text: 'KYC required' } }
					]
				}
			],
			differing: [
				{
					title: 'Fees and ATM access',
					rows: [
						{
							label: 'Annual fee',
							values: [
								{ kind: 'text', text: 'None' },
								{ kind: 'text', text: '$20/year' }
							]
						},
						{ label: 'ATM terms', values: [null, { kind: 'text', text: '$250/day' }] }
					]
				}
			],
			undisclosed: []
		})
	})

	test('keeps page order for fields and sections only a later tier lists', () => {
		const comparison = compare(
			[{ fees: { annual_label: 'None' } }, { other_fees: [fee('Physical card: $50')] }],
			[
				{
					fees: { annual_label: '$20/year', annual_first_year: { amount_minor: 0, minor_exponent: 2, currencies: [] } },
					perks: [{ code: 'lounge', label: 'Airport lounge access', status: 'available' }]
				},
				{ other_fees: [fee('Physical card: $75')] }
			]
		)

		expect(comparison.differing.map((section) => [section.title, section.rows.map((row) => row.label)])).toEqual([
			['Rewards and perks', ['Perks']],
			['Fees and ATM access', ['Annual fee', 'First-year annual fee', 'Physical card']]
		])
	})

	test('names a field once when no tier states a value for it', () => {
		const iban = { disclosure: { iban: { status: 'not_publicly_disclosed' as const } } }
		const comparison = compare([{}, iban], [{}], [{}, iban])

		expect(comparison.undisclosed).toEqual(['IBAN'])
		expect(comparison.differing).toEqual([])
	})

	test('matches a fee across tiers whatever its casing', () => {
		const comparison = compare(
			[{}, { other_fees: [fee('Card shipping: $0')] }],
			[{}, { other_fees: [fee('Card Shipping: $0')] }]
		)

		expect(comparison.differing).toEqual([])
		expect(comparison.shared).toContainEqual({
			title: 'Fees and ATM access',
			fields: [{ label: 'Card shipping', value: { kind: 'text', text: '$0' } }]
		})
	})

	test('treats every field of a lone tier as shared', () => {
		expect(compare([{ fees: { annual_label: '$20/year' } }])).toEqual({
			shared: [
				{
					title: 'Eligibility and availability',
					fields: [{ label: 'Requirements', value: { kind: 'text', text: 'None' } }]
				},
				{
					title: 'Fees and ATM access',
					fields: [{ label: 'Annual fee', value: { kind: 'text', text: '$20/year' } }]
				}
			],
			differing: [],
			undisclosed: []
		})
	})
})

describe('cardKeyFacts', () => {
	test('leads with cashback, lowest fees, and how many countries can get the card', () => {
		const card = cardsIndexCard('kast')
		card.roll.cashback_base_bps = 200
		card.roll.cashback_max_bps = 300
		card.roll.annual_fee_min = { amount_minor: 0, minor_exponent: 2, currencies: [] }
		card.roll.fx_min_bps = 0
		card.countries = ['AE', 'US']

		expect(cardKeyFacts(card)).toEqual([
			{ label: 'Cashback', value: '2% – 3%' },
			{ label: 'Lowest annual fee', value: 'None' },
			{ label: 'Lowest FX fee', value: '0%' },
			{ label: 'Available in', value: '2 countries' }
		])
	})

	test('leaves facts the issuer does not disclose empty', () => {
		const card = cardsIndexCard('kast')
		card.availability = 'not_publicly_disclosed'
		card.countries = ['US']

		expect(cardKeyFacts(card)).toEqual([
			{ label: 'Cashback', value: null },
			{ label: 'Lowest annual fee', value: null },
			{ label: 'Lowest FX fee', value: null },
			{ label: 'Available in', value: null }
		])
	})

	test('reads a lone top rate as "Up to" when tiers earn different rates', () => {
		const card = cardsIndexCard('ethena-pay')
		card.tiers.push({ ...card.tiers[0]!, id: 'ethena-pay--vip', name: 'VIP' })
		card.roll.cashback_base_bps = 500
		card.roll.cashback_max_bps = 500

		expect(cardKeyFacts(card)[0]).toEqual({ label: 'Cashback', value: 'Up to 5%' })
	})

	test('shows one rate when base and maximum cashback match', () => {
		const card = cardsIndexCard('kast')
		card.roll.cashback_base_bps = 300
		card.roll.cashback_max_bps = 300

		expect(cardKeyFacts(card)[0]).toEqual({ label: 'Cashback', value: '3%' })
	})
})
