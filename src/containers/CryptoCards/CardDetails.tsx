import type { ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import type { IProtocolPageMetrics } from '~/containers/ProtocolOverview/types'
import type { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { Icon } from '~/ui/Icon'
import { Tag } from '~/ui/Tag'
import { countryDisplayName } from '~/utils/countries'
import { formatDate } from '~/utils/dateFormat'
import { letterLogoDataUri } from '~/utils/icons'
import { formatNumber, formatPercent } from '~/utils/numberFormat'
import type {
	CardsAmount,
	CardsDetailFee,
	CardsDetailResponse,
	CardsDetailTier,
	CardsDisclosure,
	CardsIndexCard,
	CardsTier,
	CardsTierCashback
} from './api.types'

export interface CardDetailsModel {
	card: CardsIndexCard
	detail: CardsDetailResponse
}

export interface IssuerCardDetailsModel {
	cards: Array<CardDetailsModel>
	countries: Record<string, string>
	issuerLogo: string | null
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }

function humanize(value: string): string {
	return value
		.replaceAll('_', ' ')
		.replaceAll('-', ' ')
		.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function amountLabel(amount: CardsAmount | undefined): string | null {
	if (!amount) return null
	const value = amount.amount_minor / 10 ** amount.minor_exponent
	const formatted = formatNumber(value, { maximumFractionDigits: Math.min(amount.minor_exponent, 2) })
	if (amount.currencies.length === 0) return formatted
	return amount.currencies.map((currency) => `${CURRENCY_SYMBOLS[currency] ?? `${currency} `}${formatted}`).join(' / ')
}

function rateLabel(bps: number | undefined): string | null {
	return bps == null ? null : formatPercent(bps / 100, { input: 'percent', maximumFractionDigits: 2 })
}

function withPeriod(value: string | null, period: string | null | undefined): string | null {
	if (!value) return null
	return period ? `${value} per ${period}` : value
}

function booleanLabel(value: 0 | 1 | undefined): string | null {
	return value == null ? null : value === 1 ? 'Yes' : 'No'
}

function listLabel(values: Array<string> | undefined): string | null {
	return values?.length ? values.map(humanize).join(', ') : null
}

function knownValue(value: ReactNode): ReactNode {
	return value == null || value === '' ? <span className="text-tertiary">Not publicly disclosed</span> : value
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div className="min-w-0">
			<dt className="label-sm text-secondary">{label}</dt>
			<dd className="mt-1 body-md break-words text-primary">{knownValue(value)}</dd>
		</div>
	)
}

function DetailGroup({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-3 border-t border-subtle pt-4 first:border-t-0 first:pt-0">
			<h4 className="heading-xs">{title}</h4>
			<dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">{children}</dl>
		</section>
	)
}

function feesLabel(fees: Array<CardsDetailFee>): string | null {
	if (fees.length === 0) return null
	return fees
		.map((fee) => {
			const qualifiers = [fee.form_factor ? humanize(fee.form_factor) : null, fee.period].filter(Boolean)
			return qualifiers.length > 0 ? `${fee.label} (${qualifiers.join(', ')})` : fee.label
		})
		.join('; ')
}

function gateLabel(tier: CardsTier): string | null {
	if (tier.access === 'ungated') return 'None'
	if (tier.access !== 'gated') return null
	const options = tier.gate?.options.map((option) => option.label) ?? []
	if (options.length === 0) return 'Gated'
	return options.join(tier.gate?.mode === 'all' ? ' and ' : ' or ')
}

function countriesLabel(codes: Array<string>, names: Record<string, string>): string | null {
	if (codes.length === 0) return null
	return codes.map((code) => names[code] ?? countryDisplayName(code)).join(', ')
}

function cashbackBands(cashback: CardsTierCashback | undefined): string | null {
	if (!cashback?.bands?.length) return null
	return cashback.bands
		.map((band) => {
			const rate = rateLabel(band.rate_bps)
			const spend = withPeriod(amountLabel(band.cumulative_spend), band.period)
			return spend ? `${rate} through ${spend} cumulative spend` : rate
		})
		.filter((value): value is string => value != null)
		.join('; ')
}

function cashbackBoosters(cashback: CardsTierCashback | undefined): string | null {
	if (!cashback?.everyday?.boosters.length) return null
	return cashback.everyday.boosters
		.map((booster) => {
			const threshold = withPeriod(amountLabel(booster.threshold), booster.period)
			return `${booster.label}: +${rateLabel(booster.increment_bps)}${threshold ? ` at ${threshold}` : ''}`
		})
		.join('; ')
}

function tradingVolumeBands(cashback: CardsTierCashback | undefined): string | null {
	if (!cashback?.trading_volume_bands?.length) return null
	return cashback.trading_volume_bands
		.map((band) => {
			const volume = withPeriod(amountLabel(band.minimum_volume), band.volume_period)
			const spendCap = withPeriod(amountLabel(band.eligible_spend_cap), band.eligible_spend_cap_period)
			return `${volume ?? 'Qualifying volume'}: ${rateLabel(band.rate_bps)} on up to ${spendCap ?? 'an undisclosed spend cap'}`
		})
		.join('; ')
}

function disclosureStatus(disclosure: CardsDisclosure): string {
	if (disclosure.status === 'explicitly_none') return 'Explicitly none'
	if (disclosure.status === 'confirmed') return 'Confirmed'
	return disclosure.absence_reason ? `Not disclosed: ${humanize(disclosure.absence_reason)}` : 'Not publicly disclosed'
}

function uniqueBy<T>(items: Array<T>, key: (item: T) => string): Array<T> {
	const seen = new Set<string>()
	return items.filter((item) => {
		const itemKey = key(item)
		if (seen.has(itemKey)) return false
		seen.add(itemKey)
		return true
	})
}

function DisclosureDetails({ tier }: { tier: CardsDetailTier }) {
	const disclosures = Object.entries(tier.disclosure).sort(([left], [right]) => left.localeCompare(right))
	if (disclosures.length === 0) return null
	return (
		<details className="border-t border-subtle pt-4">
			<summary className="w-fit cursor-pointer label-md text-secondary hover:text-primary focus-visible:focus-ring">
				Disclosure status and sources ({disclosures.length})
			</summary>
			<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{disclosures.map(([field, disclosure]) => (
					<div key={field} className="min-w-0">
						<p className="label-sm text-secondary">{humanize(field)}</p>
						<Tag className="mt-1">{disclosureStatus(disclosure)}</Tag>
						{uniqueBy(
							disclosure.derivations ?? [],
							(derivation) =>
								`${derivation.operation}-${derivation.rule_id}-${derivation.rule_version}-${derivation.explanation}`
						).map((derivation) => (
							<div
								key={`${derivation.operation}-${derivation.rule_id}-${derivation.rule_version}-${derivation.explanation}`}
								className="mt-2 body-sm text-secondary"
							>
								<p>{derivation.explanation}</p>
								{uniqueBy(
									derivation.evidence,
									(evidence) => `${evidence.source_url}-${evidence.content_sha256}-${evidence.source_verbatim}`
								).map((evidence) => (
									<blockquote
										key={`${evidence.source_url}-${evidence.content_sha256}-${evidence.source_verbatim}`}
										className="mt-2 border-l-2 border-medium pl-3"
									>
										<p>{evidence.source_verbatim}</p>
										<a
											href={evidence.source_url}
											target="_blank"
											rel="noopener noreferrer"
											className="mt-1 inline-flex items-center gap-1 text-link hover:underline"
										>
											Official source
											<Icon name="external-link" className="size-3" aria-hidden="true" />
										</a>
									</blockquote>
								))}
							</div>
						))}
					</div>
				))}
			</div>
		</details>
	)
}

function CardSummary({
	card,
	countries,
	headingId,
	issuerLogo
}: {
	card: CardsIndexCard
	countries: Record<string, string>
	headingId: string
	issuerLogo: string | null
}) {
	const verified = formatDate(card.as_of)
	const cashbackRange =
		card.roll.cashback_base_bps == null && card.roll.cashback_max_bps == null
			? null
			: [rateLabel(card.roll.cashback_base_bps), rateLabel(card.roll.cashback_max_bps)].filter(Boolean).join(' – ')
	return (
		<Card as="header" padding="md" className="flex flex-col gap-5">
			<div className="flex flex-wrap items-center gap-4">
				<TokenLogo
					src={issuerLogo ?? card.logo}
					fallbackSrc={letterLogoDataUri(card.name)}
					alt={`${card.name} logo`}
					size={48}
				/>
				<div className="min-w-0 flex-1">
					<p className="body-sm text-secondary">Crypto card</p>
					<h2 id={headingId} className="heading-md">
						{card.name}
					</h2>
					<p className="mt-1 body-sm text-secondary">
						{verified ? `Terms verified ${verified}` : 'Verification date not disclosed'}
						{card.data_status === 'carried_forward' ? ' · Carried forward from the last verified dataset' : ''}
					</p>
				</div>
				{card.url ? (
					<Button as="a" href={card.url} target="_blank" rel="noopener noreferrer" size="md" className="w-fit">
						Visit Website
						<Icon name="external-link" className="size-3.5" aria-hidden="true" />
					</Button>
				) : null}
			</div>
			<dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
				<DetailItem label="Availability" value={card.availability === 'confirmed' ? 'Confirmed' : null} />
				<DetailItem label="Countries" value={countriesLabel(card.countries ?? [], countries)} />
				<DetailItem label="Cashback range" value={cashbackRange} />
				<DetailItem label="Minimum annual fee" value={amountLabel(card.roll.annual_fee_min)} />
				<DetailItem label="Minimum FX fee" value={rateLabel(card.roll.fx_min_bps)} />
				<DetailItem label="Networks" value={listLabel(card.roll.networks)} />
				<DetailItem label="Card types" value={listLabel(card.roll.classes)} />
				<DetailItem label="Ungated option" value={card.roll.has_confirmed_ungated_tier ? 'Yes' : 'No'} />
			</dl>
		</Card>
	)
}

function TierDetails({
	tier,
	detail,
	cardCountries,
	countries
}: {
	tier: CardsTier
	detail: CardsDetailTier | undefined
	cardCountries: Array<string>
	countries: Record<string, string>
}) {
	const cashback = tier.cashback
	const effectiveCountries = tier.countries ?? cardCountries
	return (
		<Card as="article" padding="md" className="flex flex-col gap-6">
			<header>
				<p className="body-sm text-secondary">{tier.region}</p>
				<h3 className="heading-sm">{tier.name}</h3>
			</header>

			<DetailGroup title="Eligibility and availability">
				<DetailItem label="Availability" value={tier.availability === 'confirmed' ? 'Confirmed' : null} />
				<DetailItem label="Countries" value={countriesLabel(effectiveCountries, countries)} />
				<DetailItem label="Requirements" value={gateLabel(tier)} />
				<DetailItem label="Requirement mode" value={tier.gate ? humanize(tier.gate.mode) : null} />
				<DetailItem label="KYC / credit check" value={detail?.kyc} />
				<DetailItem label="Subscription" value={detail?.subscription} />
				<DetailItem label="Staking requirement" value={detail?.staking} />
				<DetailItem label="Card issuance" value={detail ? feesLabel(detail.card_issue) : null} />
			</DetailGroup>

			<DetailGroup title="Rewards and perks">
				<DetailItem label="Cashback" value={cashback?.label} />
				<DetailItem label="Base cashback" value={rateLabel(cashback?.base_bps)} />
				<DetailItem label="Maximum cashback" value={rateLabel(cashback?.max_bps)} />
				<DetailItem label="Promotional cashback" value={rateLabel(cashback?.promo_bps)} />
				<DetailItem label="Payout asset" value={cashback?.payout_asset} />
				<DetailItem
					label="Payout cap"
					value={withPeriod(amountLabel(cashback?.payout_cap), cashback?.payout_cap_period)}
				/>
				<DetailItem
					label="Eligible spend cap"
					value={withPeriod(amountLabel(cashback?.spend_cap), cashback?.spend_cap_period)}
				/>
				<DetailItem label="Cashback bands" value={cashbackBands(cashback)} />
				<DetailItem label="Everyday cashback base" value={rateLabel(cashback?.everyday?.base_bps)} />
				<DetailItem label="Everyday cashback maximum" value={rateLabel(cashback?.everyday?.max_bps)} />
				<DetailItem label="Cashback boosters" value={cashbackBoosters(cashback)} />
				<DetailItem label="Trading-volume bands" value={tradingVolumeBands(cashback)} />
				<DetailItem
					label="After-cap fallback"
					value={cashback?.fallback_after_cap ? humanize(cashback.fallback_after_cap) : null}
				/>
				<DetailItem
					label="Perks"
					value={tier.perks
						?.map((perk) => `${perk.label}${perk.status === 'available' ? '' : ` (${humanize(perk.status)})`}`)
						.join('; ')}
				/>
				<DetailItem label="Signup bonus" value={detail?.signup_bonus} />
				<DetailItem label="Referral bonus" value={detail?.referral?.label} />
			</DetailGroup>

			<DetailGroup title="Fees and ATM access">
				<DetailItem label="Annual fee" value={tier.fees.annual_label ?? amountLabel(tier.fees.annual)} />
				<DetailItem label="First-year annual fee" value={amountLabel(tier.fees.annual_first_year)} />
				<DetailItem label="FX fee" value={tier.fees.fx_label ?? rateLabel(tier.fees.fx_bps)} />
				<DetailItem label="ATM withdrawals" value={booleanLabel(tier.atm.available)} />
				<DetailItem label="ATM terms" value={tier.atm.label} />
				<DetailItem
					label="ATM withdrawal fee"
					value={amountLabel(tier.atm.withdrawal_fee) ?? rateLabel(tier.atm.withdrawal_fee_bps)}
				/>
				<DetailItem
					label="Free ATM allowance"
					value={withPeriod(amountLabel(tier.atm.free_withdrawal_limit), tier.atm.free_withdrawal_period)}
				/>
				<DetailItem label="Other fees" value={detail ? feesLabel(detail.other_fees) : null} />
			</DetailGroup>

			<DetailGroup title="Card and crypto support">
				<DetailItem label="Card type" value={tier.type.class ? humanize(tier.type.class) : null} />
				<DetailItem label="Network" value={tier.type.network ? humanize(tier.type.network) : null} />
				<DetailItem label="Form" value={listLabel(tier.type.forms)} />
				<DetailItem label="Issuer" value={tier.type.issuer} />
				<DetailItem label="Custody" value={tier.crypto.custody ? humanize(tier.crypto.custody) : null} />
				<DetailItem label="Supported chains" value={listLabel(tier.crypto.chains)} />
				<DetailItem label="Supported coins" value={tier.crypto.coins?.join(', ') || null} />
			</DetailGroup>

			<DetailGroup title="Integrations and limits">
				<DetailItem label="Apple Pay" value={booleanLabel(tier.integrations.apple_pay)} />
				<DetailItem label="Google Pay" value={booleanLabel(tier.integrations.google_pay)} />
				<DetailItem label="IBAN" value={booleanLabel(tier.integrations.iban)} />
				<DetailItem label="Daily spending limit" value={tier.limits.daily_label ?? amountLabel(tier.limits.daily)} />
				<DetailItem
					label="Monthly spending limit"
					value={tier.limits.monthly_label ?? amountLabel(tier.limits.monthly)}
				/>
			</DetailGroup>

			{detail ? <DisclosureDetails tier={detail} /> : null}
		</Card>
	)
}

export function IssuerCardDetails({ cards, countries, issuerLogo }: IssuerCardDetailsModel) {
	return (
		<div className="flex flex-1 flex-col gap-2">
			{cards.map(({ card, detail }) => {
				const detailByTier = new Map(detail.tiers.map((tier) => [tier.id, tier]))
				const headingId = `crypto-card-${card.id}`
				return (
					<section key={card.id} aria-labelledby={headingId} className="flex flex-col gap-2">
						<CardSummary card={card} countries={countries} headingId={headingId} issuerLogo={issuerLogo} />
						{card.tiers.map((tier) => (
							<TierDetails
								key={tier.id}
								tier={tier}
								detail={detailByTier.get(tier.id)}
								cardCountries={card.countries ?? []}
								countries={countries}
							/>
						))}
					</section>
				)
			})}
		</div>
	)
}

export interface CryptoCardDetailsPageProps {
	issuerSlug: string
	name: string
	logo: string | null
	overviewHref: string | null
	category: string | null
	otherProtocols: Array<string>
	metrics: IProtocolPageMetrics
	warningBanners: ReturnType<typeof getProtocolWarningBanners>
	cards: Array<CardDetailsModel>
	countries: Record<string, string>
}

export function CryptoCardDetailsPage(props: CryptoCardDetailsPageProps) {
	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="cardDetails"
			warningBanners={props.warningBanners}
			seoTitle={`${props.name} Card Details - DefiLlama`}
			seoDescription={`Review ${props.name} card rewards, fees, eligibility, limits, supported assets, integrations, and source-backed disclosures.`}
			informationHref={props.overviewHref}
			cardDetailsSlug={props.issuerSlug}
		>
			<EntityTitleStrip
				media={
					props.logo ? (
						<TokenLogo src={props.logo} size={28} alt={`Logo of ${props.name}`} />
					) : (
						<TokenLogo name={props.name} kind="token" size={28} alt={`Logo of ${props.name}`} />
					)
				}
				title={`${props.name} Card Details`}
			/>
			<Card padding="sm" className="body-sm text-secondary">
				<p>
					Terms, rewards, fees, eligibility, supported assets, and source-backed disclosures for every card issued by{' '}
					{props.name}.{' '}
					<BasicLink href="/crypto-cards" className="text-link hover:underline">
						Compare all crypto cards
					</BasicLink>
					.
				</p>
			</Card>
			<IssuerCardDetails cards={props.cards} countries={props.countries} issuerLogo={props.logo} />
		</ProtocolOverviewLayout>
	)
}
