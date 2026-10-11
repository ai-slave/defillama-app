import { type ReactNode, useState } from 'react'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import type { IProtocolPageMetrics } from '~/containers/ProtocolOverview/types'
import type { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { Icon } from '~/ui/Icon'
import { Logo } from '~/ui/Logo'
import { MetaLine } from '~/ui/MetaLine'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { InlineStatStrip } from '~/ui/SummaryStats'
import { Tag } from '~/ui/Tag'
import { formatDate } from '~/utils/dateFormat'
import { cryptoCardIconUrl, letterLogoDataUri } from '~/utils/icons'
import type { CardsDetailResponse, CardsDetailTier, CardsIndexCard } from './api.types'
import {
	type CardDetailSection,
	type CardDetailValue,
	cardKeyFacts,
	cardTraits,
	compareTiers,
	disclosureStatusLabel,
	humanize,
	tierDetailSections
} from './detailRows'
import { GetCardButton } from './GetCardButton'

export interface CardDetailsModel {
	card: CardsIndexCard
	detail: CardsDetailResponse
}

/** A country list runs to 85 chips, so long lists start at a few rows. A list only a little
 *  longer shows whole, rather than hiding one or two chips behind a button. */
const COLLAPSED_CHIPS = 8
const COLLAPSE_AFTER = 12

function ChipList({ items }: { items: Array<string> }) {
	const [expanded, setExpanded] = useState(false)
	const collapsible = items.length > COLLAPSE_AFTER
	const shown = expanded || !collapsible ? items : items.slice(0, COLLAPSED_CHIPS)
	return (
		<ul className="flex flex-wrap items-center gap-1">
			{shown.map((item) => (
				<li key={item}>
					<Tag className="whitespace-nowrap">{item}</Tag>
				</li>
			))}
			{collapsible ? (
				<li>
					<Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
						{expanded ? 'Show fewer' : `+${items.length - COLLAPSED_CHIPS} more`}
					</Button>
				</li>
			) : null}
		</ul>
	)
}

function DetailValue({ value }: { value: CardDetailValue | null }) {
	if (value == null) return <span className="text-tertiary">–</span>
	switch (value.kind) {
		case 'text':
			return <span className="break-words">{value.text}</span>
		case 'list':
			return <ChipList items={value.items} />
		case 'notes':
			return (
				<ul className="flex flex-col gap-1">
					{value.items.map((item) => (
						<li key={item} className="break-words">
							{item}
						</li>
					))}
				</ul>
			)
		case 'undisclosed':
			return <span className="text-tertiary">Not disclosed</span>
	}
}

function DetailSections({ sections, heading }: { sections: Array<CardDetailSection>; heading: 'h3' | 'h4' }) {
	const Heading = heading
	return sections.map((section, index) => (
		<section
			key={section.title}
			className={`flex flex-col gap-3 ${index > 0 ? 'border-t border-subtle pt-4' : ''}`.trim()}
		>
			<Heading className="label-lg">{section.title}</Heading>
			<dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
				{section.fields.map((field) => (
					<div key={field.label} className="min-w-0">
						<dt className="label-sm text-secondary">{field.label}</dt>
						<dd className="mt-1 body-md text-primary">
							<DetailValue value={field.value} />
						</dd>
					</div>
				))}
			</dl>
		</section>
	))
}

function TierComparisonTable({
	card,
	comparison,
	headingId,
	heading
}: {
	card: CardsIndexCard
	comparison: ReturnType<typeof compareTiers>
	headingId: string
	heading: 'h2' | 'h3'
}) {
	// Regional tiers often share a name ("Default" in International and United States), and then
	// the region is what tells the columns apart.
	const namesRepeat = new Set(card.tiers.map((tier) => tier.name)).size < card.tiers.length
	return (
		<Panel role="region" aria-labelledby={headingId}>
			<PanelHeader>
				<PanelTitle as={heading} id={headingId}>
					Compare tiers
				</PanelTitle>
			</PanelHeader>
			<div className="overflow-x-auto">
				{/* Fixed tier columns keep each value near its label on a wide screen; the last column
				    only fills the rest of the card so row borders reach its edge. */}
				<table className="w-full table-fixed border-collapse body-md">
					<colgroup>
						<col className="w-28 sm:w-40" />
						{card.tiers.map((tier) => (
							<col key={tier.id} className="w-40 sm:w-72" />
						))}
						<col />
					</colgroup>
					<thead>
						<tr>
							{/* The label column stays put while a card with many tiers scrolls sideways. */}
							<td className="sticky left-0 z-1 bg-surface" />
							{card.tiers.map((tier) => (
								<th key={tier.id} scope="col" className="px-4 py-3 text-left align-bottom">
									<span className="block label-md text-primary">{namesRepeat ? tier.region : tier.name}</span>
									<span className="block body-sm text-secondary">{namesRepeat ? tier.name : tier.region}</span>
								</th>
							))}
							<td />
						</tr>
					</thead>
					{comparison.differing.map((section) => (
						<tbody key={section.title}>
							<tr>
								<th
									scope="colgroup"
									colSpan={card.tiers.length + 2}
									className="border-t border-subtle bg-surface-elevated-1 px-4 py-2 text-left label-sm text-secondary"
								>
									{/* The band spans every tier; its title stays in view while they scroll. */}
									<span className="sticky left-4">{section.title}</span>
								</th>
							</tr>
							{section.rows.map((row) => (
								<tr key={row.label} className="border-t border-subtle">
									<th
										scope="row"
										className="sticky left-0 z-1 bg-surface px-4 py-3 text-left align-top label-sm text-secondary"
									>
										{row.label}
									</th>
									{row.values.map((value, index) => (
										<td key={card.tiers[index]!.id} className="px-4 py-3 align-top">
											<DetailValue value={value} />
										</td>
									))}
									<td />
								</tr>
							))}
						</tbody>
					))}
				</table>
			</div>
		</Panel>
	)
}

function TierSources({ tier, title, heading }: { tier: CardsDetailTier; title: string | null; heading: 'h3' | 'h4' }) {
	const Heading = heading
	const disclosures = Object.entries(tier.disclosure).sort(([left], [right]) => left.localeCompare(right))
	if (disclosures.length === 0) return null
	return (
		<div className="flex flex-col gap-3">
			{title ? <Heading className="label-md text-primary">{title}</Heading> : null}
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{disclosures.map(([field, disclosure]) => (
					<div key={field} className="min-w-0">
						<p className="label-sm text-secondary">{humanize(field)}</p>
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
		</div>
	)
}

function CardSection({
	card,
	detail,
	countries,
	heading,
	intro
}: CardDetailsModel & {
	countries: Record<string, string>
	/** The card name is the page heading when the issuer has one card. */
	heading: 'h1' | 'h2'
	/** Rendered under the card header on a one-card page; a multi-card page shows it once on top. */
	intro: ReactNode
}) {
	const Heading = heading
	const headingId = `crypto-card-${card.id}`
	// Panel and section headings sit one and two levels under the card name, whichever it is.
	const panelHeading = heading === 'h1' ? 'h2' : 'h3'
	const sectionHeading = heading === 'h1' ? 'h3' : 'h4'
	const verified = formatDate(card.as_of)
	const traits = cardTraits(card)
	const detailByTier = new Map(detail.tiers.map((tier) => [tier.id, tier]))
	const comparison = compareTiers(
		card.tiers.map((tier) => tierDetailSections(tier, detailByTier.get(tier.id), card.countries ?? [], countries))
	)
	const sourceCount = detail.tiers.reduce((total, tier) => total + Object.keys(tier.disclosure).length, 0)

	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-2">
			<Card as="header" padding="md" className="flex flex-wrap items-center gap-4">
				<Logo
					src={card.logo ?? cryptoCardIconUrl(card.id)}
					fallbackSrc={letterLogoDataUri(card.name)}
					alt={`${card.name} logo`}
					size={48}
				/>
				<div className="min-w-48 flex-1">
					<Heading id={headingId} className="heading-sm">
						{card.name}
					</Heading>
					<MetaLine className="mt-1">
						{traits}
						{verified ? `Terms verified ${verified}` : 'Verification date not disclosed'}
						{card.data_status === 'carried_forward' ? 'Carried forward from the last verified dataset' : null}
					</MetaLine>
				</div>
				<GetCardButton cardId={card.id} cardName={card.name} url={card.url ?? null} placement="details" />
			</Card>
			{intro}
			<InlineStatStrip
				stacked
				items={cardKeyFacts(card).map((fact) => ({
					label: fact.label,
					value: fact.value ?? <span className="text-tertiary">Not disclosed</span>
				}))}
			/>
			{comparison.differing.length > 0 ? (
				<TierComparisonTable
					card={card}
					comparison={comparison}
					headingId={`${headingId}-tiers`}
					heading={panelHeading}
				/>
			) : null}
			<Panel role="region" aria-labelledby={`${headingId}-shared`}>
				<PanelHeader>
					<PanelTitle as={panelHeading} id={`${headingId}-shared`}>
						{card.tiers.length > 1 ? 'Same on every tier' : 'Card details'}
					</PanelTitle>
				</PanelHeader>
				<div className="flex flex-col gap-4 p-4">
					<DetailSections sections={comparison.shared} heading={sectionHeading} />
					{comparison.undisclosed.length > 0 ? (
						<p className="border-t border-subtle pt-4 body-sm text-tertiary">
							{`Not publicly disclosed: ${comparison.undisclosed.join(', ')}.`}
						</p>
					) : null}
					{sourceCount > 0 ? (
						<details className="border-t border-subtle pt-4">
							<summary className="w-fit cursor-pointer label-md text-secondary hover:text-primary focus-visible:focus-ring">
								{`Disclosure status and sources (${sourceCount})`}
							</summary>
							<div className="mt-4 flex flex-col gap-6">
								{card.tiers.map((tier) => {
									const tierDetail = detailByTier.get(tier.id)
									return tierDetail ? (
										<TierSources
											key={tier.id}
											tier={tierDetail}
											title={card.tiers.length > 1 ? tier.name : null}
											heading={sectionHeading}
										/>
									) : null
								})}
							</div>
						</details>
					) : null}
				</div>
			</Panel>
		</section>
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
	const intro = (
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
	)
	// A page with one card leads with that card, its name as the page heading. A page with several
	// keeps the issuer title on top, so there is one h1 and each card name is an h2 below it.
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
			{props.cards.length > 1 ? (
				<>
					<EntityTitleStrip
						media={<TokenLogo name={props.name} kind="token" size={28} alt={`Logo of ${props.name}`} />}
						title={title}
					/>
					{intro}
				</>
			) : null}
			<div className="flex flex-1 flex-col gap-4">
				{props.cards.map(({ card, detail }) => (
					<CardSection
						key={card.id}
						card={card}
						detail={detail}
						countries={props.countries}
						heading={props.cards.length > 1 ? 'h2' : 'h1'}
						intro={props.cards.length > 1 ? null : intro}
					/>
				))}
			</div>
		</ProtocolOverviewLayout>
	)
}
