import { countryDisplayName } from '~/utils/countries'
import type {
	CardsAmount,
	CardsDetailFee,
	CardsDetailTier,
	CardsDisclosure,
	CardsIndexCard,
	CardsIntegrationFlag,
	CardsTier,
	CardsTierCashback
} from './api.types'
import { accessLabel, amountLabel, bpsLabel, perkLabel } from './models'

export interface CardDetailRow {
	label: string
	value: string
	/** "Not publicly disclosed" reads as support text, not as a value. */
	muted: boolean
}

export interface CardDetailGroup {
	title: string
	rows: Array<CardDetailRow>
}

function humanize(value: string): string {
	return value
		.replaceAll('_', ' ')
		.replaceAll('-', ' ')
		.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function withPeriod(value: string | null, period: string | null | undefined): string | null {
	if (!value) return null
	return period ? `${value} per ${period}` : value
}

function yesNo(value: CardsIntegrationFlag | undefined): string | null {
	return value == null ? null : value === 1 ? 'Yes' : 'No'
}

function listLabel(values: Array<string> | undefined): string | null {
	return values?.length ? values.map(humanize).join(', ') : null
}

function countriesLabel(codes: Array<string>, names: Record<string, string>): string | null {
	if (codes.length === 0) return null
	return codes.map((code) => names[code] ?? countryDisplayName(code)).join(', ')
}

function feesLabel(fees: Array<CardsDetailFee> | undefined): string | null {
	if (!fees?.length) return null
	return fees
		.map((fee) => {
			const qualifiers = [fee.form_factor ? humanize(fee.form_factor) : null, fee.period].filter(Boolean)
			return qualifiers.length > 0 ? `${fee.label} (${qualifiers.join(', ')})` : fee.label
		})
		.join('; ')
}

function cashbackBands(cashback: CardsTierCashback | undefined): string | null {
	if (!cashback?.bands?.length) return null
	return cashback.bands
		.map((band) => {
			const rate = bpsLabel(band.rate_bps)
			const spend = withPeriod(amountLabel(band.cumulative_spend), band.period)
			return spend ? `${rate} through ${spend} cumulative spend` : rate
		})
		.join('; ')
}

function cashbackBoosters(cashback: CardsTierCashback | undefined): string | null {
	if (!cashback?.everyday?.boosters.length) return null
	return cashback.everyday.boosters
		.map((booster) => {
			const threshold = withPeriod(amountLabel(booster.threshold), booster.period)
			return `${booster.label}: +${bpsLabel(booster.increment_bps)}${threshold ? ` at ${threshold}` : ''}`
		})
		.join('; ')
}

function tradingVolumeBands(cashback: CardsTierCashback | undefined): string | null {
	if (!cashback?.trading_volume_bands?.length) return null
	return cashback.trading_volume_bands
		.map((band) => {
			const volume = withPeriod(amountLabel(band.minimum_volume), band.volume_period)
			const spendCap = withPeriod(amountLabel(band.eligible_spend_cap), band.eligible_spend_cap_period)
			return `${volume}: ${bpsLabel(band.rate_bps)} on up to ${spendCap}`
		})
		.join('; ')
}

/** A stated value wins. Without one, the API's disclosure status for the field says whether the
 *  issuer publishes none or does not say. A field the API does not track stays hidden, so an
 *  absent promo rate is not reported as withheld. */
function row(label: string, value: string | null | undefined, disclosure?: CardsDisclosure): CardDetailRow | null {
	if (value) return { label, value, muted: false }
	if (disclosure?.status === 'explicitly_none') return { label, value: 'None', muted: false }
	if (disclosure?.status === 'not_publicly_disclosed') return { label, value: 'Not publicly disclosed', muted: true }
	return null
}

function group(title: string, rows: Array<CardDetailRow | null>): CardDetailGroup | null {
	const shown = rows.filter((entry): entry is CardDetailRow => entry != null)
	return shown.length > 0 ? { title, rows: shown } : null
}

function amountOrRate(amount: CardsAmount | undefined, bps: number | undefined): string | null {
	return amountLabel(amount) ?? bpsLabel(bps)
}

export function cardSummaryRows(card: CardsIndexCard, countries: Record<string, string>): Array<CardDetailRow> {
	const { roll } = card
	const cashbackRange = [...new Set([bpsLabel(roll.cashback_base_bps), bpsLabel(roll.cashback_max_bps)])]
		.filter(Boolean)
		.join(' – ')
	return [
		row('Availability', card.availability === 'confirmed' ? 'Confirmed' : null, { status: card.availability }),
		row('Countries', countriesLabel(card.countries ?? [], countries)),
		row('Cashback range', cashbackRange),
		row('Minimum annual fee', amountLabel(roll.annual_fee_min)),
		row('Minimum FX fee', bpsLabel(roll.fx_min_bps)),
		row('Networks', listLabel(roll.networks)),
		row('Card types', listLabel(roll.classes)),
		row('Ungated option', roll.has_confirmed_ungated_tier ? 'Yes' : 'No')
	].filter((entry): entry is CardDetailRow => entry != null)
}

export function tierDetailGroups(
	tier: CardsTier,
	detail: CardsDetailTier | undefined,
	cardCountries: Array<string>,
	countries: Record<string, string>
): Array<CardDetailGroup> {
	const { cashback, fees, atm, type, crypto, integrations, limits } = tier
	const disclosure = detail?.disclosure ?? {}
	return [
		group('Eligibility and availability', [
			// Availability and access carry their own disclosure state instead of a disclosure entry.
			row('Availability', tier.availability === 'confirmed' ? 'Confirmed' : null, { status: tier.availability }),
			row('Countries', countriesLabel(tier.countries ?? cardCountries, countries), disclosure.supported_countries),
			row(
				'Requirements',
				accessLabel(tier),
				tier.access === 'not_publicly_disclosed' ? { status: tier.access } : undefined
			),
			row('KYC / credit check', detail?.kyc, disclosure.credit_check_kyc_requirements),
			row('Subscription', detail?.subscription, disclosure.subscription),
			row('Staking requirement', detail?.staking, disclosure.staking),
			row('Card issuance', feesLabel(detail?.card_issue), disclosure.card_issuance_fee)
		]),
		group('Rewards and perks', [
			row('Cashback', cashback?.label, disclosure.cashback_rate),
			row('Base cashback', bpsLabel(cashback?.base_bps), disclosure.cashback_base),
			row('Maximum cashback', bpsLabel(cashback?.max_bps), disclosure.cashback_maximum),
			row('Promotional cashback', bpsLabel(cashback?.promo_bps), disclosure.cashback_promotional),
			row('Payout asset', cashback?.payout_asset, disclosure.cashback_currency),
			row(
				'Payout cap',
				withPeriod(amountLabel(cashback?.payout_cap), cashback?.payout_cap_period),
				disclosure.maximum_cashback_per_month
			),
			row(
				'Eligible spend cap',
				withPeriod(amountLabel(cashback?.spend_cap), cashback?.spend_cap_period),
				disclosure.cashback_spend_cap
			),
			row('Cashback bands', cashbackBands(cashback)),
			row('Everyday cashback base', bpsLabel(cashback?.everyday?.base_bps)),
			row('Everyday cashback maximum', bpsLabel(cashback?.everyday?.max_bps)),
			row('Cashback boosters', cashbackBoosters(cashback)),
			row('Trading-volume bands', tradingVolumeBands(cashback)),
			row('After-cap fallback', cashback?.fallback_after_cap ? humanize(cashback.fallback_after_cap) : null),
			row('Perks', tier.perks?.map(perkLabel).join('; '), disclosure.perks),
			row('Signup bonus', detail?.signup_bonus, disclosure.signup_bonus),
			row('Referral bonus', detail?.referral?.label, disclosure.referral_bonus)
		]),
		group('Fees and ATM access', [
			row('Annual fee', fees.annual_label ?? amountLabel(fees.annual), disclosure.annual_fee),
			row('First-year annual fee', amountLabel(fees.annual_first_year), disclosure.annual_fee_first_year),
			row('FX fee', fees.fx_label ?? bpsLabel(fees.fx_bps), disclosure.fx_fee),
			row('ATM withdrawals', yesNo(atm.available), disclosure.atm_withdrawals),
			row('ATM terms', atm.label),
			row('ATM withdrawal fee', amountOrRate(atm.withdrawal_fee, atm.withdrawal_fee_bps), disclosure.domestic_atm_fee),
			row(
				'Free ATM allowance',
				withPeriod(amountLabel(atm.free_withdrawal_limit), atm.free_withdrawal_period),
				disclosure.free_withdrawal_limit
			),
			row('Other fees', feesLabel(detail?.other_fees), disclosure.other_fees)
		]),
		group('Card and crypto support', [
			row('Card type', type.class ? humanize(type.class) : null, disclosure.card_classification),
			row('Network', type.network ? humanize(type.network) : null, disclosure.network),
			row('Form', listLabel(type.forms), disclosure.virtual_physical),
			row('Issuer', type.issuer, disclosure.issuer),
			row('Custody', crypto.custody ? humanize(crypto.custody) : null, disclosure.custody_type),
			row('Supported chains', listLabel(crypto.chains), disclosure.supported_chains),
			row('Supported coins', crypto.coins?.join(', '), disclosure.supported_coins)
		]),
		group('Integrations and limits', [
			row('Apple Pay', yesNo(integrations.apple_pay), disclosure.apple_pay),
			row('Google Pay', yesNo(integrations.google_pay), disclosure.google_pay),
			row('IBAN', yesNo(integrations.iban), disclosure.iban),
			row('Daily spending limit', limits.daily_label ?? amountLabel(limits.daily), disclosure.daily_spending_limit),
			row(
				'Monthly spending limit',
				limits.monthly_label ?? amountLabel(limits.monthly),
				disclosure.monthly_spending_limit
			)
		])
	].filter((entry): entry is CardDetailGroup => entry != null)
}

export function disclosureStatusLabel(disclosure: CardsDisclosure): string {
	if (disclosure.status === 'explicitly_none') return 'Explicitly none'
	if (disclosure.status === 'confirmed') return 'Confirmed'
	return disclosure.absence_reason ? `Not disclosed: ${humanize(disclosure.absence_reason)}` : 'Not publicly disclosed'
}

export function disclosureFieldLabel(field: string): string {
	return humanize(field)
}
