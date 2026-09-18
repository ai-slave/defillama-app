import { tokenIconUrl } from '~/utils/icons'
import { formatNumber, formatPercent } from '~/utils/numberFormat'
import type {
	CardsAmount,
	CardsIndexCard,
	CardsIndexResponse,
	CardsIntegrationFlag,
	CardsPerk,
	CardsTier,
	CardsTierCashback
} from './api.types'

/** One table row = one card tier. Card-level fields repeat on every row. */
export interface CardTierRow {
	rowKind: 'tier'
	// card level
	cardId: string
	cardName: string
	parentId: string
	logo: string | null
	url: string | null
	/** Effective ISO alpha-2 codes for this tier; empty with availabilityUnknown when not disclosed. */
	countryCodes: Array<string>
	countryCount: number
	availabilityUnknown: boolean
	tierCount: number
	// tier level
	tierId: string
	tierName: string
	region: string
	cashbackRate: string | null
	cashbackCurrency: string | null
	maxCashbackPerMonth: string | null
	perks: Array<string>
	annualFee: string | null
	fxFee: string | null
	/** What unlocks the tier: "None" (ungated) or the gate options. */
	access: string | null
	supportedChains: Array<string>
	supportedCoins: Array<string>
	custodyType: string | null
	cardClassification: string | null
	network: string | null
	virtualPhysical: string | null
	issuer: string | null
	virtual: boolean | null
	physical: boolean | null
	applePay: boolean | null
	googlePay: boolean | null
	iban: boolean | null
	atmFee: string | null
	atmAllowance: string | null
	dailySpendingLimit: string | null
	monthlySpendingLimit: string | null
}

/** Symbol/chain lookup maps used to resolve logos and links at render time. */
export interface CardsReferenceModel {
	coinGeckoIds: Record<string, string>
	chainNames: Record<string, string>
}

export interface CardsIndexModel {
	rows: Array<CardTierRow>
	reference: CardsReferenceModel
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }

function amountLabel(amount: CardsAmount | undefined): string | null {
	if (!amount) return null
	const value = amount.amount_minor / 10 ** amount.minor_exponent
	const formatted = formatNumber(value, { maximumFractionDigits: 2 })
	const currency = amount.currencies[0]
	if (!currency) return formatted
	if (CURRENCY_SYMBOLS[currency]) return `${CURRENCY_SYMBOLS[currency]}${formatted}`
	return `${formatted} ${currency}`
}

function payoutCapLabel(cashback: CardsTierCashback | undefined): string | null {
	const cap = amountLabel(cashback?.payout_cap)
	if (cap == null) return null
	return cashback?.payout_cap_period ? `${cap}/${cashback.payout_cap_period}` : cap
}

function bpsLabel(bps: number | undefined): string | null {
	return bps == null ? null : formatPercent(bps / 100, { input: 'percent', maximumFractionDigits: 2 })
}

function accessLabel(tier: CardsTier): string | null {
	if (tier.access === 'ungated') return 'None'
	if (tier.access !== 'gated') return null
	const options = tier.gate?.options.map((option) => option.label) ?? []
	if (options.length === 0) return 'Gated'
	return options.join(tier.gate?.mode === 'all' ? ' and ' : ' or ')
}

/** Forms are claims; an absent form is unknown, never a denial. */
function formsLabel(forms: Array<string>): string | null {
	const virtual = forms.includes('virtual')
	const physical = forms.includes('physical')
	if (virtual && physical) return 'Virtual and physical'
	if (virtual) return 'Virtual'
	if (physical) return 'Physical'
	return null
}

function integrationBoolean(value: CardsIntegrationFlag | undefined): boolean | null {
	return value == null ? null : value !== 0
}

function perkLabel(perk: CardsPerk): string {
	if (perk.status === 'available') return perk.label
	return `${perk.label} (${perk.status.replaceAll('_', ' ')})`
}

function mapTier(card: CardsIndexCard, tier: CardsTier): CardTierRow {
	const forms = tier.type.forms ?? []
	const countries = tier.countries ?? card.countries ?? []
	return {
		rowKind: 'tier',
		cardId: card.id,
		cardName: card.name,
		parentId: card.parent_id ?? card.id,
		logo: card.logo ?? null,
		url: card.url ?? null,
		countryCodes: countries,
		countryCount: countries.length,
		availabilityUnknown: tier.availability !== 'confirmed',
		tierCount: card.tiers.length,
		tierId: tier.id,
		tierName: tier.name,
		region: tier.region,
		cashbackRate: tier.cashback?.label ?? null,
		cashbackCurrency: tier.cashback?.payout_asset ?? null,
		maxCashbackPerMonth: payoutCapLabel(tier.cashback),
		perks: (tier.perks ?? []).map(perkLabel),
		annualFee: tier.fees.annual_label ?? null,
		fxFee: tier.fees.fx_label ?? null,
		access: accessLabel(tier),
		supportedChains: tier.crypto.chains ?? [],
		supportedCoins: tier.crypto.coins ?? [],
		custodyType: tier.crypto.custody ?? null,
		cardClassification: tier.type.class ?? null,
		network: tier.type.network ?? null,
		virtualPhysical: formsLabel(forms),
		issuer: tier.type.issuer ?? null,
		virtual: forms.includes('virtual') ? true : null,
		physical: forms.includes('physical') ? true : null,
		applePay: integrationBoolean(tier.integrations.apple_pay),
		googlePay: integrationBoolean(tier.integrations.google_pay),
		iban: integrationBoolean(tier.integrations.iban),
		atmFee: bpsLabel(tier.atm.withdrawal_fee_bps),
		atmAllowance: tier.atm.label ?? null,
		dailySpendingLimit: tier.limits.daily_label ?? null,
		monthlySpendingLimit: tier.limits.monthly_label ?? null
	}
}

/** Card-level stand-in when tiers disclose different values that can't be
 *  summarized as a range; the tier rows carry the detail. */
export const VARIES_BY_TIER = 'Varies by tier'

export type CardBooleanField = 'virtual' | 'physical' | 'applePay' | 'googlePay' | 'iban'
export type CardTextField =
	| 'region'
	| 'cashbackRate'
	| 'cashbackCurrency'
	| 'maxCashbackPerMonth'
	| 'annualFee'
	| 'fxFee'
	| 'access'
	| 'custodyType'
	| 'cardClassification'
	| 'network'
	| 'virtualPhysical'
	| 'issuer'
	| 'atmFee'
	| 'atmAllowance'
	| 'dailySpendingLimit'
	| 'monthlySpendingLimit'

export type CardTierRollupField = CardBooleanField | CardTextField

export type TierBooleanRollup = boolean | null | typeof VARIES_BY_TIER

/** A table row: a card (with its tiers as expandable subRows) or one tier. */
export interface CardTableRow extends Omit<CardTierRow, CardBooleanField | 'rowKind'> {
	rowKind: 'parent' | 'card' | 'tier'
	virtual: TierBooleanRollup
	physical: TierBooleanRollup
	applePay: TierBooleanRollup
	googlePay: TierBooleanRollup
	iban: TierBooleanRollup
	subRows?: Array<CardTableRow>
	/** Leaf tiers used when a rolled-up field needs a comparison popover. */
	comparisonRows?: Array<CardTierRow>
}

type NonEmptyArray<T> = [T, ...Array<T>]

/** A claim holds at card level when every tier that discloses one agrees. */
function mergedBoolean(values: Array<boolean | null>): TierBooleanRollup {
	let merged: boolean | null = null
	for (const value of values) {
		if (value == null) continue
		if (merged == null) merged = value
		else if (merged !== value) return VARIES_BY_TIER
	}
	return merged
}

/** "up to 3%", "$1,000 per year", "$5,000/day" — one amount, one unit. */
const SIMPLE_AMOUNT = /^(?:up to\s+)?([$€£]?)([\d,]+(?:\.\d+)?)(%?)(?:\s*(?:\/|per\s+)(year|month|mo|day))?$/i

interface ParsedAmount {
	value: string
	amount: number
	kind: string
}

function parseSimpleAmount(value: string): ParsedAmount | null {
	const match = value.match(SIMPLE_AMOUNT)
	if (!match) return null
	const [, currency = '', amountText, percent = '', cadence = ''] = match
	if (amountText === undefined) return null
	return {
		value,
		amount: Number(amountText.replace(/,/g, '')),
		kind: `${currency || percent}/${cadence.toLowerCase() === 'mo' ? 'month' : cadence.toLowerCase()}`
	}
}

/** Free-text merge: agreement wins; disagreeing simple amounts of one kind
 *  collapse to a "min – max" range; anything else varies by tier. */
function mergedText(values: Array<string | null>): string | null {
	const present = [...new Set(values.filter((value): value is string => value != null))]
	if (present.length === 0) return null
	const [onlyValue] = present
	if (present.length === 1) return onlyValue ?? null

	const parsed = present.map(parseSimpleAmount)
	const first = parsed[0]
	if (!first) return VARIES_BY_TIER
	let minimum = first
	let maximum = first
	for (let index = 1; index < parsed.length; index += 1) {
		const entry = parsed[index]
		if (!entry || entry.kind !== first.kind) return VARIES_BY_TIER
		if (entry.amount < minimum.amount) minimum = entry
		if (entry.amount > maximum.amount) maximum = entry
	}
	return `${minimum.value} – ${maximum.value}`
}

function mergedList(lists: Array<Array<string>>): Array<string> {
	const values = new Set<string>()
	for (const list of lists) {
		for (const value of list) values.add(value)
	}
	return [...values]
}

/** The card offers/supports the union of its tiers; disagreeing scalar
 *  values roll up to a range or vary by tier. */
function mergeTiers(tiers: NonEmptyArray<CardTierRow>): CardTableRow {
	const first = tiers[0]
	const countryCodes = mergedList(tiers.map((tier) => tier.countryCodes))
	const text = (key: CardTextField) => mergedText(tiers.map((tier) => tier[key]))
	const bool = (key: CardBooleanField) => mergedBoolean(tiers.map((tier) => tier[key]))
	return {
		...first,
		rowKind: 'card',
		tierName: '',
		countryCodes,
		countryCount: countryCodes.length,
		availabilityUnknown: tiers.some((tier) => tier.availabilityUnknown),
		region: text('region') ?? '',
		cashbackRate: text('cashbackRate'),
		cashbackCurrency: text('cashbackCurrency'),
		maxCashbackPerMonth: text('maxCashbackPerMonth'),
		perks: mergedList(tiers.map((tier) => tier.perks)),
		annualFee: text('annualFee'),
		fxFee: text('fxFee'),
		access: text('access'),
		supportedChains: mergedList(tiers.map((tier) => tier.supportedChains)),
		supportedCoins: mergedList(tiers.map((tier) => tier.supportedCoins)),
		custodyType: text('custodyType'),
		cardClassification: text('cardClassification'),
		network: text('network'),
		virtualPhysical: text('virtualPhysical'),
		issuer: text('issuer'),
		virtual: bool('virtual'),
		physical: bool('physical'),
		applePay: bool('applePay'),
		googlePay: bool('googlePay'),
		iban: bool('iban'),
		atmFee: text('atmFee'),
		atmAllowance: text('atmAllowance'),
		dailySpendingLimit: text('dailySpendingLimit'),
		monthlySpendingLimit: text('monthlySpendingLimit'),
		subRows: tiers,
		comparisonRows: tiers
	}
}

function cardRow(tiers: NonEmptyArray<CardTierRow>): CardTableRow {
	if (tiers.length > 1) return mergeTiers(tiers)
	return { ...tiers[0], rowKind: 'card', comparisonRows: tiers }
}

const NON_ALPHANUMERIC = /[^a-z0-9]/gi

function parentProtocolName(parentId: string, cards: NonEmptyArray<CardTableRow>): string {
	const normalizedParentId = parentId.replace(NON_ALPHANUMERIC, '').toLowerCase()
	for (const card of cards) {
		const words = card.cardName.split(/\s+/)
		for (let index = 1; index <= words.length; index += 1) {
			const candidate = words
				.slice(0, index)
				.join(' ')
				.replace(/[^a-z0-9.]+$/i, '')
			const normalizedCandidate = candidate.replace(NON_ALPHANUMERIC, '').toLowerCase()
			if (normalizedCandidate === normalizedParentId) return candidate
			if (normalizedCandidate.length > normalizedParentId.length) break
		}
	}
	return parentId
		.split(/[-_]+/)
		.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
		.join(' ')
}

function parentRow(
	parentId: string,
	cards: NonEmptyArray<CardTableRow>,
	tiers: NonEmptyArray<CardTierRow>
): CardTableRow {
	const merged = mergeTiers(tiers)
	const cardName = parentProtocolName(parentId, cards)
	const countryCodes = mergedList(cards.map((card) => card.countryCodes))
	return {
		...merged,
		rowKind: 'parent',
		cardId: parentId,
		cardName,
		parentId,
		logo: tokenIconUrl(cardName),
		url: null,
		countryCodes,
		countryCount: countryCodes.length,
		availabilityUnknown: cards.some((card) => card.availabilityUnknown),
		tierCount: tiers.length,
		tierId: `parent:${parentId}`,
		tierName: '',
		subRows: cards,
		comparisonRows: tiers
	}
}

/** One row per standalone card or parent protocol. Parent protocols expand
 *  into cards, and multi-tier cards expand once more into their tiers. Group
 *  after filtering so every rollup reflects only surviving tiers. */
export function groupCardRows(rows: Array<CardTierRow>): Array<CardTableRow> {
	const byCard = new Map<string, NonEmptyArray<CardTierRow>>()
	for (const row of rows) {
		const tiers = byCard.get(row.cardId)
		if (tiers) tiers.push(row)
		else byCard.set(row.cardId, [row])
	}

	const cards = [...byCard.values()].map(cardRow)
	const cardsByParent = new Map<string, NonEmptyArray<CardTableRow>>()
	const tiersByParent = new Map<string, NonEmptyArray<CardTierRow>>()
	for (const card of cards) {
		if (card.parentId === card.cardId) continue
		const siblingCards = cardsByParent.get(card.parentId)
		if (siblingCards) siblingCards.push(card)
		else cardsByParent.set(card.parentId, [card])

		const cardTiers = byCard.get(card.cardId)!
		const siblingTiers = tiersByParent.get(card.parentId)
		if (siblingTiers) siblingTiers.push(...cardTiers)
		else tiersByParent.set(card.parentId, [...cardTiers])
	}

	const groupedRows: Array<CardTableRow> = []
	const emittedParents = new Set<string>()
	for (const card of cards) {
		if (card.parentId === card.cardId) {
			groupedRows.push(card)
			continue
		}
		if (emittedParents.has(card.parentId)) continue
		emittedParents.add(card.parentId)
		groupedRows.push(parentRow(card.parentId, cardsByParent.get(card.parentId)!, tiersByParent.get(card.parentId)!))
	}
	return groupedRows
}

export function mapCardsIndex(response: CardsIndexResponse): CardsIndexModel {
	const rows: Array<CardTierRow> = []
	for (const card of response.cards) {
		for (const tier of card.tiers) rows.push(mapTier(card, tier))
	}
	return {
		rows,
		reference: {
			coinGeckoIds: response.reference.coin_gecko_ids,
			chainNames: response.reference.defillama_chain_names
		}
	}
}
