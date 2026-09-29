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
import { formatDate } from '~/utils/dateFormat'
import { cryptoCardIconUrl, letterLogoDataUri } from '~/utils/icons'
import type { CardsDetailResponse, CardsDetailTier, CardsIndexCard } from './api.types'
import {
	type CardDetailRow,
	cardSummaryRows,
	disclosureFieldLabel,
	disclosureStatusLabel,
	tierDetailGroups
} from './detailRows'

export interface CardDetailsModel {
	card: CardsIndexCard
	detail: CardsDetailResponse
}

function DetailList({ rows, className }: { rows: Array<CardDetailRow>; className: string }) {
	return (
		<dl className={`grid gap-x-6 gap-y-4 ${className}`}>
			{rows.map((row) => (
				<div key={row.label} className="min-w-0">
					<dt className="label-sm text-secondary">{row.label}</dt>
					<dd className={`mt-1 body-md break-words ${row.muted ? 'text-tertiary' : 'text-primary'}`}>{row.value}</dd>
				</div>
			))}
		</dl>
	)
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
						<p className="label-sm text-secondary">{disclosureFieldLabel(field)}</p>
						<Tag className="mt-1">{disclosureStatusLabel(disclosure)}</Tag>
						{disclosure.derivations?.map((derivation) => (
							<div key={`${derivation.operation}-${derivation.explanation}`} className="mt-2 body-sm text-secondary">
								<p>{derivation.explanation}</p>
								{derivation.evidence
									// The cards API can repeat one quote within a derivation.
									.filter(
										(evidence, index, all) =>
											all.findIndex(
												(other) =>
													other.source_url === evidence.source_url && other.source_verbatim === evidence.source_verbatim
											) === index
									)
									.map((evidence) => (
										<blockquote
											key={`${evidence.source_url}-${evidence.source_verbatim}`}
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
	headingId
}: {
	card: CardsIndexCard
	countries: Record<string, string>
	headingId: string
}) {
	const verified = formatDate(card.as_of)
	return (
		<Card as="header" padding="md" className="flex flex-col gap-5">
			<div className="flex flex-wrap items-center gap-4">
				<TokenLogo
					src={card.logo ?? cryptoCardIconUrl(card.id)}
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
			<DetailList rows={cardSummaryRows(card, countries)} className="sm:grid-cols-2 xl:grid-cols-4" />
		</Card>
	)
}

function IssuerCardDetails({
	cards,
	countries
}: {
	cards: Array<CardDetailsModel>
	countries: Record<string, string>
}) {
	return (
		<div className="flex flex-1 flex-col gap-2">
			{cards.map(({ card, detail }) => {
				const detailByTier = new Map(detail.tiers.map((tier) => [tier.id, tier]))
				const headingId = `crypto-card-${card.id}`
				return (
					<section key={card.id} aria-labelledby={headingId} className="flex flex-col gap-2">
						<CardSummary card={card} countries={countries} headingId={headingId} />
						{card.tiers.map((tier) => {
							const tierDetail = detailByTier.get(tier.id)
							return (
								<Card key={tier.id} as="article" padding="md" className="flex flex-col gap-6">
									<header>
										<p className="body-sm text-secondary">{tier.region}</p>
										<h3 className="heading-sm">{tier.name}</h3>
									</header>
									{tierDetailGroups(tier, tierDetail, card.countries ?? [], countries).map((group) => (
										<section
											key={group.title}
											className="flex flex-col gap-3 border-t border-subtle pt-4 first:border-t-0 first:pt-0"
										>
											<h4 className="heading-xs">{group.title}</h4>
											<DetailList rows={group.rows} className="sm:grid-cols-2 xl:grid-cols-3" />
										</section>
									))}
									{tierDetail ? <DisclosureDetails tier={tierDetail} /> : null}
								</Card>
							)
						})}
					</section>
				)
			})}
		</div>
	)
}

export interface CryptoCardDetailsPageProps {
	name: string
	isCEX: boolean
	category: string | null
	otherProtocols: Array<string>
	metrics: IProtocolPageMetrics
	warningBanners: ReturnType<typeof getProtocolWarningBanners>
	cards: Array<CardDetailsModel>
	countries: Record<string, string>
}

export function CryptoCardDetailsPage(props: CryptoCardDetailsPageProps) {
	// Most card issuers are listed as "<Brand> Card"; avoid "Kast Card Card Details".
	const title = props.name.endsWith(' Card') ? `${props.name} Details` : `${props.name} Card Details`
	return (
		<ProtocolOverviewLayout
			name={props.name}
			isCEX={props.isCEX}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="cardDetails"
			warningBanners={props.warningBanners}
			seoTitle={`${title} - DefiLlama`}
			seoDescription={`Review ${props.name} card rewards, fees, eligibility, limits, supported assets, integrations, and source-backed disclosures.`}
		>
			<EntityTitleStrip
				media={<TokenLogo name={props.name} kind="token" size={28} alt={`Logo of ${props.name}`} />}
				title={title}
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
			<IssuerCardDetails cards={props.cards} countries={props.countries} />
		</ProtocolOverviewLayout>
	)
}
