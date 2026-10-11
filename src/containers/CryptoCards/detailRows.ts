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

/** A list renders as chips and notes as stacked sentences, so no value is ever a
 *  "; "-joined run of text. "Not publicly disclosed" is its own kind: it reads as
 *  support text, and fields every tier leaves undisclosed collapse into one line. */
export type CardDetailValue =
	| { kind: 'text'; text: string }
	| { kind: 'list'; items: Array<string> }
	| { kind: 'notes'; items: Array<string> }
	| { kind: 'undisclosed' }

export interface CardDetailField {
	label: string
	value: CardDetailValue
}

export interface CardDetailSection {
	title: string
	fields: Array<CardDetailField>
}

export interface CardKeyFact {
	label: string
	/** Null when the issuer does not disclose it. */
	value: string | null
}

export function humanize(value: string): string {
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

function countryNames(codes: Array<string>, names: Record<string, string>): Array<string> {
	return codes.map((code) => names[code] ?? countryDisplayName(code))
}

function cashbackBands(cashback: CardsTierCashback | undefined): Array<string> {
	return (cashback?.bands ?? []).map((band) => {
		const rate = bpsLabel(band.rate_bps)
		const spend = withPeriod(amountLabel(band.cumulative_spend), band.period)
		return spend ? `${rate} through ${spend} cumulative spend` : `${rate}`
	})
}

function cashbackBoosters(cashback: CardsTierCashback | undefined): Array<string> {
	return (cashback?.everyday?.boosters ?? []).map((booster) => {
		const threshold = withPeriod(amountLabel(booster.threshold), booster.period)
		return `${booster.label}: +${bpsLabel(booster.increment_bps)}${threshold ? ` at ${threshold}` : ''}`
	})
}

function tradingVolumeBands(cashback: CardsTierCashback | undefined): Array<string> {
	return (cashback?.trading_volume_bands ?? []).map((band) => {
		const volume = withPeriod(amountLabel(band.minimum_volume), band.volume_period)
		const spendCap = withPeriod(amountLabel(band.eligible_spend_cap), band.eligible_spend_cap_period)
		return `${volume}: ${bpsLabel(band.rate_bps)} on up to ${spendCap}`
	})
}

/** A stated value wins. Without one, the API's disclosure status for the field says whether the
 *  issuer publishes none or does not say. A field the API does not track stays hidden, so an
 *  absent promo rate is not reported as withheld. */
function field(
	label: string,
	value: string | Array<string> | null | undefined,
	disclosure?: CardsDisclosure
): CardDetailField | null {
	if (typeof value === 'string' && value) return { label, value: { kind: 'text', text: value } }
	if (Array.isArray(value) && value.length > 0) return { label, value: { kind: 'list', items: value } }
	if (disclosure?.status === 'explicitly_none') return { label, value: { kind: 'text', text: 'None' } }
	if (disclosure?.status === 'not_publicly_disclosed') return { label, value: { kind: 'undisclosed' } }
	return null
}

function notesField(label: string, items: Array<string>): CardDetailField | null {
	return items.length > 0 ? { label, value: { kind: 'notes', items } } : null
}

function section(title: string, fields: Array<CardDetailField | null>): CardDetailSection | null {
	const shown = fields.filter((entry): entry is CardDetailField => entry != null)
	return shown.length > 0 ? { title, fields: shown } : null
}

/** Whether issuer text already states a value: "4%" appears in "4% first $2,500/month", but not
 *  in "14%" or "4.5%". A structured row that only repeats the issuer's own summary is left out. */
function mentions(text: string | null | undefined, value: string | null): boolean {
	if (!text || !value) return false
	const escaped = value.replace(/[.*+?^$()|[\]\\]/g, '\\$&')
	return new RegExp(`(?<![\\d.])${escaped}(?!\\d)`).test(text)
}

function amountOrRate(amount: CardsAmount | undefined, bps: number | undefined): string | null {
	return amountLabel(amount) ?? bpsLabel(bps)
}

/** "Card shipping: $0", or "Cross-Border Fee | None". */
const FEE_ENTRY = /^([^:;|]{1,60}?)(?::| \|) (.+)$/

/** The API packs fees into labels three ways: one "Name: amount" per fee; several fees in one
 *  label ("Late payment: 2%; Returned payment: None"), where "; " also separates an amount's own
 *  qualifiers ("Priority delivery: $50; tracked; 1-2 weeks"); and plain sentences with no name.
 *  A "; " starts a new fee only when a name follows it. Tiers also list one fee twice with
 *  different casing, wording or a trailing explanation, and a fee may repeat a field the page already shows, so each
 *  name appears once and the first mention wins. */
function feeFields(fees: Array<CardsDetailFee>, shownLabels: Array<string>): Array<CardDetailField> {
	const seen = new Set(shownLabels.map((label) => label.toLowerCase()))
	const fields: Array<CardDetailField> = []
	const notes: Array<string> = []
	for (const fee of fees) {
		const entries: Array<string> = []
		for (const part of fee.label.split('; ')) {
			if (entries.length > 0 && !FEE_ENTRY.test(part)) entries[entries.length - 1] += `; ${part}`
			else entries.push(part)
		}
		for (const entry of entries) {
			const match = entry.match(FEE_ENTRY)
			if (!match) {
				if (!notes.some((note) => note.toLowerCase() === entry.toLowerCase())) notes.push(entry)
				continue
			}
			const [, rawName = '', amount = ''] = match
			const formNote =
				fee.form_factor && !rawName.toLowerCase().includes(fee.form_factor) ? ` (${fee.form_factor})` : ''
			const name = `${rawName.trim()}${formNote}`
			// "Cross-Border Fee (transactions with foreign merchants)" is the same fee as "Cross-Border Fee".
			const key = `${rawName.replace(/\s*\([^)]*\)\s*$/, '').trim()}${formNote}`.toLowerCase()
			if (seen.has(key)) continue
			seen.add(key)
			// Amounts arrive as written on issuer sites: "none", "free; untracked; 3-4 weeks".
			const text = `${amount.slice(0, 1).toUpperCase()}${amount.slice(1)}`
			fields.push({ label: name, value: { kind: 'text', text: withPeriod(text, fee.period)! } })
		}
	}
	const notesEntry = notesField('Other fee terms', notes)
	if (notesEntry) fields.push(notesEntry)
	return fields
}

export function cardKeyFacts(card: CardsIndexCard): Array<CardKeyFact> {
	const { roll } = card
	const base = bpsLabel(roll.cashback_base_bps)
	const max = bpsLabel(roll.cashback_max_bps)
	// A lone top rate is only what the best tier or the first spend band earns, so it reads "Up to".
	const ratesVary = card.tiers.length > 1 || card.tiers.some((tier) => (tier.cashback?.bands?.length ?? 0) > 0)
	const cashback = base && max && base !== max ? `${base} – ${max}` : max && ratesVary ? `Up to ${max}` : (max ?? base)
	const countryCount = card.countries?.length ?? 0
	return [
		{ label: 'Cashback', value: cashback },
		{ label: 'Lowest annual fee', value: amountLabel(roll.annual_fee_min) },
		{ label: 'Lowest FX fee', value: bpsLabel(roll.fx_min_bps) },
		{
			label: 'Available in',
			value:
				card.availability === 'confirmed' && countryCount > 0
					? `${countryCount} ${countryCount === 1 ? 'country' : 'countries'}`
					: null
		}
	]
}

/** The card types and networks its tiers share (Credit, Visa), one MetaLine item each. */
export function cardTraits(card: CardsIndexCard): Array<string> {
	return [...card.roll.classes, ...card.roll.networks].map(humanize)
}

export function tierDetailSections(
	tier: CardsTier,
	detail: CardsDetailTier | undefined,
	cardCountries: Array<string>,
	countries: Record<string, string>
): Array<CardDetailSection> {
	const { cashback, fees, atm, type, crypto, integrations, limits } = tier
	const disclosure = detail?.disclosure ?? {}
	const cashbackText = cashback?.label
	const bandsStated = (cashback?.bands ?? []).every((band) => mentions(cashbackText, bpsLabel(band.rate_bps)))
	/** A rate row shows only when the issuer's cashback text does not already state it. */
	const rateField = (label: string, bps: number | undefined, status?: CardsDisclosure) =>
		mentions(cashbackText, bpsLabel(bps)) ? null : field(label, bpsLabel(bps), status)
	const fixedFees = [
		field('Annual fee', fees.annual_label ?? amountLabel(fees.annual), disclosure.annual_fee),
		field('First-year annual fee', amountLabel(fees.annual_first_year), disclosure.annual_fee_first_year),
		field('FX fee', fees.fx_label ?? bpsLabel(fees.fx_bps), disclosure.fx_fee),
		field('ATM withdrawals', yesNo(atm.available), disclosure.atm_withdrawals),
		field('ATM terms', atm.label),
		mentions(atm.label, amountOrRate(atm.withdrawal_fee, atm.withdrawal_fee_bps))
			? null
			: field(
					'ATM withdrawal fee',
					amountOrRate(atm.withdrawal_fee, atm.withdrawal_fee_bps),
					disclosure.domestic_atm_fee
				),
		field(
			'Free ATM allowance',
			withPeriod(amountLabel(atm.free_withdrawal_limit), atm.free_withdrawal_period),
			disclosure.free_withdrawal_limit
		)
	]
	const listedFees = feeFields(
		[...(detail?.card_issue ?? []), ...(detail?.other_fees ?? [])],
		fixedFees.flatMap((entry) => (entry && entry.value.kind !== 'undisclosed' ? [entry.label] : []))
	)
	return [
		section('Eligibility and availability', [
			field(
				'Countries',
				countryNames(tier.countries ?? cardCountries, countries),
				// Availability carries its own disclosure state instead of a disclosure entry.
				tier.availability === 'confirmed' ? disclosure.supported_countries : { status: tier.availability }
			),
			field(
				'Requirements',
				accessLabel(tier),
				tier.access === 'not_publicly_disclosed' ? { status: tier.access } : undefined
			),
			field('KYC / credit check', detail?.kyc, disclosure.credit_check_kyc_requirements),
			field('Subscription', detail?.subscription, disclosure.subscription),
			field('Staking requirement', detail?.staking, disclosure.staking)
		]),
		section('Rewards and perks', [
			field('Cashback', cashback?.label, disclosure.cashback_rate),
			rateField('Base cashback', cashback?.base_bps, disclosure.cashback_base),
			rateField('Maximum cashback', cashback?.max_bps, disclosure.cashback_maximum),
			rateField('Promotional cashback', cashback?.promo_bps, disclosure.cashback_promotional),
			field('Payout asset', cashback?.payout_asset, disclosure.cashback_currency),
			field(
				'Payout cap',
				withPeriod(amountLabel(cashback?.payout_cap), cashback?.payout_cap_period),
				disclosure.maximum_cashback_per_month
			),
			field(
				'Eligible spend cap',
				withPeriod(amountLabel(cashback?.spend_cap), cashback?.spend_cap_period),
				disclosure.cashback_spend_cap
			),
			bandsStated ? null : notesField('Cashback bands', cashbackBands(cashback)),
			rateField('Everyday cashback base', cashback?.everyday?.base_bps),
			rateField('Everyday cashback maximum', cashback?.everyday?.max_bps),
			notesField('Cashback boosters', cashbackBoosters(cashback)),
			notesField('Trading-volume bands', tradingVolumeBands(cashback)),
			field('After-cap fallback', cashback?.fallback_after_cap ? humanize(cashback.fallback_after_cap) : null),
			field('Perks', tier.perks?.map(perkLabel), disclosure.perks),
			field('Signup bonus', detail?.signup_bonus, disclosure.signup_bonus),
			field('Referral bonus', detail?.referral?.label, disclosure.referral_bonus)
		]),
		section('Fees and ATM access', [
			...fixedFees,
			...listedFees,
			listedFees.length === 0 ? field('Other fees', null, disclosure.other_fees) : null
		]),
		section('Card and crypto support', [
			field('Card type', type.class ? humanize(type.class) : null, disclosure.card_classification),
			field('Network', type.network ? humanize(type.network) : null, disclosure.network),
			field('Form', type.forms?.map(humanize), disclosure.virtual_physical),
			field('Issuer', type.issuer, disclosure.issuer),
			field('Custody', crypto.custody ? humanize(crypto.custody) : null, disclosure.custody_type),
			field('Supported chains', crypto.chains?.map(humanize), disclosure.supported_chains),
			field('Supported coins', crypto.coins, disclosure.supported_coins)
		]),
		section('Integrations and limits', [
			field('Apple Pay', yesNo(integrations.apple_pay), disclosure.apple_pay),
			field('Google Pay', yesNo(integrations.google_pay), disclosure.google_pay),
			field('IBAN', yesNo(integrations.iban), disclosure.iban),
			field('Daily spending limit', limits.daily_label ?? amountLabel(limits.daily), disclosure.daily_spending_limit),
			field(
				'Monthly spending limit',
				limits.monthly_label ?? amountLabel(limits.monthly),
				disclosure.monthly_spending_limit
			)
		])
	].filter((entry): entry is CardDetailSection => entry != null)
}

export interface TierComparisonRow {
	label: string
	/** One value per tier, in tier order; null where the tier does not state the field at all. */
	values: Array<CardDetailValue | null>
}

export interface TierComparison {
	/** Fields whose value differs between tiers, grouped in page order. */
	differing: Array<{ title: string; rows: Array<TierComparisonRow> }>
	/** Fields every tier states identically, shown once. */
	shared: Array<CardDetailSection>
	/** Fields no tier discloses, named once instead of one "Not publicly disclosed" row each. */
	undisclosed: Array<string>
}

/** Puts a key only a later tier lists right after the key that tier lists before it, so a field
 *  such as "First-year annual fee" keeps its place instead of trailing every other row. */
function insertAfter(order: Array<string>, key: string, previous: string | null) {
	order.splice(previous == null ? 0 : order.indexOf(previous) + 1, 0, key)
}

/** Every tier repeats most of its card's terms, so the page shows each shared value once and
 *  lines tiers up only where they differ. A lone tier has nothing to compare: all of it is shared. */
export function compareTiers(tiers: Array<Array<CardDetailSection>>): TierComparison {
	const sectionOrder: Array<string> = []
	const sections = new Map<string, { order: Array<string>; rows: Map<string, TierComparisonRow> }>()
	for (const [index, tierSections] of tiers.entries()) {
		let previousTitle: string | null = null
		for (const { title, fields } of tierSections) {
			let merged = sections.get(title)
			if (!merged) {
				merged = { order: [], rows: new Map() }
				sections.set(title, merged)
				insertAfter(sectionOrder, title, previousTitle)
			}
			previousTitle = title
			let previousKey: string | null = null
			for (const { label, value } of fields) {
				// Fee names arrive in mixed case across tiers ("Card shipping", "Card Shipping").
				const key = label.toLowerCase()
				let row = merged.rows.get(key)
				if (!row) {
					row = { label, values: tiers.map(() => null) }
					merged.rows.set(key, row)
					insertAfter(merged.order, key, previousKey)
				}
				previousKey = key
				row.values[index] = value
			}
		}
	}

	const comparison: TierComparison = { differing: [], shared: [], undisclosed: [] }
	for (const title of sectionOrder) {
		const merged = sections.get(title)!
		const differing: Array<TierComparisonRow> = []
		const shared: Array<CardDetailField> = []
		for (const key of merged.order) {
			const row = merged.rows.get(key)!
			const [first] = row.values
			// A field no tier states a value for is withheld, whether tiers say so or leave it out.
			if (row.values.every((value) => value == null || value.kind === 'undisclosed')) {
				comparison.undisclosed.push(row.label)
			} else if (first != null && row.values.every((value) => JSON.stringify(value) === JSON.stringify(first))) {
				shared.push({ label: row.label, value: first })
			} else {
				differing.push(row)
			}
		}
		if (differing.length > 0) comparison.differing.push({ title, rows: differing })
		if (shared.length > 0) comparison.shared.push({ title, fields: shared })
	}
	return comparison
}

export function disclosureStatusLabel(disclosure: CardsDisclosure): string {
	if (disclosure.status === 'explicitly_none') return 'Explicitly none'
	if (disclosure.status === 'confirmed') return 'Confirmed'
	return disclosure.absence_reason ? `Not disclosed: ${humanize(disclosure.absence_reason)}` : 'Not publicly disclosed'
}
