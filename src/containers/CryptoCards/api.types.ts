// Exact wire types for the authenticated Pro API `/cards/index` response.

export type CardsAvailability = 'confirmed' | 'not_publicly_disclosed'
export type CardsAccess = 'gated' | 'ungated' | 'not_publicly_disclosed'
export type CardsDataStatus = 'carried_forward' | 'refreshed'
export type CardsIntegrationFlag = 0 | 1

export interface CardsAmount {
	amount_minor: number
	minor_exponent: number
	/** Explicitly-none money is currency-independent and uses an empty array. */
	currencies: Array<string>
}

export interface CardsGateOption {
	kind: 'deposit' | 'fee' | 'points' | 'spend' | 'stake' | 'volume' | 'unknown'
	label: string
	period?: string
	lock_months?: number
}

export interface CardsGate {
	mode: 'all' | 'any'
	options: Array<CardsGateOption>
}

export interface CardsCashbackBand {
	rate_bps: number
	cumulative_spend?: CardsAmount
	period?: string
}

export interface CardsCashbackBooster {
	kind: 'balance' | 'card_spend'
	label: string
	increment_bps: number
	threshold: CardsAmount
	period?: string
}

export interface CardsEverydayCashback {
	base_bps?: number
	max_bps?: number
	boosters: Array<CardsCashbackBooster>
}

export interface CardsTradingVolumeBand {
	minimum_volume: CardsAmount
	volume_period: string | null
	rate_bps: number
	eligible_spend_cap: CardsAmount
	eligible_spend_cap_period: string | null
}

export interface CardsTierCashback {
	label: string
	base_bps?: number
	max_bps?: number
	promo_bps?: number
	payout_asset?: string
	payout_cap?: CardsAmount
	payout_cap_period?: string
	spend_cap?: CardsAmount
	spend_cap_period?: string
	bands?: Array<CardsCashbackBand>
	everyday?: CardsEverydayCashback
	trading_volume_bands?: Array<CardsTradingVolumeBand>
	fallback_after_cap?: 'everyday'
}

export interface CardsTierFees {
	annual?: CardsAmount
	annual_label?: string
	annual_first_year?: CardsAmount
	fx_bps?: number
	fx_label?: string
}

export interface CardsTierType {
	class?: string
	network?: string
	forms?: Array<string>
	issuer?: string
}

export interface CardsTierCrypto {
	chains?: Array<string>
	coins?: Array<string>
	custody?: string
}

export interface CardsTierIntegrations {
	apple_pay?: CardsIntegrationFlag
	google_pay?: CardsIntegrationFlag
	iban?: CardsIntegrationFlag
}

export interface CardsTierAtm {
	label?: string
	withdrawal_fee_bps?: number
	free_withdrawal_period?: string
}

export interface CardsTierLimits {
	daily?: CardsAmount
	daily_label?: string
	monthly?: CardsAmount
	monthly_label?: string
}

export interface CardsPerk {
	code: string
	label: string
	status: string
}

export interface CardsTier {
	id: string
	name: string
	region: string
	availability: CardsAvailability
	access: CardsAccess
	gate?: CardsGate
	/** Tier-specific availability, when the producer publishes it. */
	countries?: Array<string>
	cashback?: CardsTierCashback
	fees: CardsTierFees
	type: CardsTierType
	crypto: CardsTierCrypto
	integrations: CardsTierIntegrations
	atm: CardsTierAtm
	limits: CardsTierLimits
	perks?: Array<CardsPerk>
}

export interface CardsRollup {
	annual_fee_min?: CardsAmount
	cashback_base_bps?: number
	cashback_max_bps?: number
	fx_min_bps?: number
	networks: Array<string>
	classes: Array<string>
	has_confirmed_ungated_tier: boolean
}

export interface CardsIndexCard {
	id: string
	name: string
	/** Parent protocol slug. Self-references and absent values mean the card is standalone. */
	parent_id?: string
	logo?: string
	url?: string
	as_of: string
	availability: CardsAvailability
	data_status: CardsDataStatus
	/** ISO 3166-1 alpha-2 codes across the whole card. */
	countries?: Array<string>
	roll: CardsRollup
	tiers: Array<CardsTier>
}

export interface CardsReference {
	/** Symbol -> CoinGecko id, only for symbols the catalog mentions. */
	coin_gecko_ids: Record<string, string>
	/** Catalog chain name -> canonical DefiLlama chain name. */
	defillama_chain_names: Record<string, string>
}

export interface CardsFacets {
	countries: Record<string, number>
	networks: Record<string, number>
	classes: Record<string, number>
	custody: Record<string, number>
	chains: Record<string, number>
	coins: Record<string, number>
	forms: Record<string, number>
	perks: Record<string, number>
	access: Record<string, number>
}

export interface CardsIndexResponse {
	version: string
	countries: Record<string, string>
	reference: CardsReference
	facets: CardsFacets
	cards: Array<CardsIndexCard>
}
