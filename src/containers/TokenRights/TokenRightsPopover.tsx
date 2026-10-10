import { BasicLink } from '~/components/Link'
import { utrGradeColor } from '~/containers/UniversalTokenRating/gradeBands'
import { GradeBadge } from '~/containers/UniversalTokenRating/grades'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import type { TokenRightsUtrSummary } from './badge'
import { TokenCardHeader, TokenCardLink } from './TokenCardHeader'
import { TokenRightsTagList } from './TokenRightsChips'
import { TokenRightsPieChart } from './TokenRightsPieChart'
import type { TokenRightsPreview } from './types'
import { getTokenRightsPieTones } from './utils'

function UtrAxisGrade({ label, grade }: { label: string; grade: TokenRightsUtrSummary['disclosureGrade'] }) {
	if (!grade) return null
	return (
		<span>
			{label} <span className={`font-semibold ${utrGradeColor(grade).text}`}>{grade}</span>
		</span>
	)
}

function UtrLink({ utr, name }: { utr: TokenRightsUtrSummary; name: string }) {
	const axes = [
		utr.disclosureGrade ? `disclosure ${utr.disclosureGrade}` : null,
		utr.performanceGrade ? `performance ${utr.performanceGrade}` : null
	].filter(Boolean)
	return (
		<TokenCardLink
			href={utr.href}
			data-umami-event="utr-link"
			data-umami-event-card="token-rights"
			data-umami-event-entity={name}
			aria-label={`Universal Token Rating ${utr.grade}${axes.length > 0 ? ` (${axes.join(', ')})` : ''}, view rating`}
		>
			<span className="flex items-center gap-1.5">
				UTR
				<GradeBadge score={null} grade={utr.grade} className="shrink-0" />
				<Icon name="arrow-right" className="size-3.5 text-link" />
			</span>
			{utr.disclosureGrade || utr.performanceGrade ? (
				<span className="flex gap-1.5">
					<UtrAxisGrade label="Disclosure" grade={utr.disclosureGrade} />
					<UtrAxisGrade label="Performance" grade={utr.performanceGrade} />
				</span>
			) : null}
		</TokenCardLink>
	)
}

export function TokenRightsPopover({
	name,
	rights,
	fullRightsHref,
	utr
}: {
	/** The row's DefiLlama name, so both cards name the entity the same way. */
	name: string
	rights: TokenRightsPreview
	fullRightsHref: string | null
	utr: TokenRightsUtrSummary | null
}) {
	const hasPrimaryValueAccrual = rights.primaryValue !== null || rights.primaryDetails !== null
	return (
		// Width excludes the popover's padding.
		<div className="w-[min(18rem,calc(var(--popover-available-width)-1.5rem))] whitespace-normal text-primary sm:w-[min(24rem,calc(var(--popover-available-width)-1.5rem))]">
			<div className="flex min-w-0 flex-col gap-2 sm:gap-2.5">
				<TokenCardHeader
					name={name}
					symbols={rights.identityTokens}
					title="Token Rights"
					action={utr ? <UtrLink utr={utr} name={name} /> : null}
				/>

				{hasPrimaryValueAccrual ? (
					<div className="flex flex-col gap-1 rounded-md border border-success-muted bg-success-tint p-2">
						<div className="label-sm tracking-wider text-secondary uppercase">Primary Value Accrual</div>
						{rights.primaryValue !== null ? <div className="title-md text-success">{rights.primaryValue}</div> : null}
						{rights.primaryDetails ? (
							<p className="line-clamp-3 label-sm text-secondary sm:line-clamp-none">{rights.primaryDetails}</p>
						) : null}
					</div>
				) : null}

				<div className="flex justify-center">
					<TokenRightsPieChart tones={getTokenRightsPieTones(rights)} />
				</div>

				{rights.utilityItems.length > 0 ? (
					<div className="flex flex-col items-center gap-1.5">
						<div className="label-sm tracking-wider text-secondary uppercase">Utility</div>
						<TokenRightsTagList items={rights.utilityItems} />
					</div>
				) : null}

				<p className="label-sm text-tertiary">
					Shows which rights the token gives its holders. It is not a verdict on whether the token is good or bad.
				</p>

				{fullRightsHref ? (
					<div className="flex justify-end">
						<BasicLink
							href={fullRightsHref}
							data-umami-event="token-rights-link"
							data-umami-event-card="token-rights"
							data-umami-event-entity={name}
							className="inline-flex items-center gap-1 label-sm text-link hover:underline"
						>
							View full token rights
							<Icon name="arrow-right" className="size-3.5" />
						</BasicLink>
					</div>
				) : null}
			</div>
		</div>
	)
}

export function TokenRightsPieHovercard({
	name,
	rights,
	fullRightsHref,
	utr,
	placement = 'left'
}: {
	name: string
	rights: TokenRightsPreview
	fullRightsHref: string | null
	utr: TokenRightsUtrSummary | null
	placement?: 'left' | 'right-start'
}) {
	return (
		<Hovercard
			content={<TokenRightsPopover name={name} rights={rights} fullRightsHref={fullRightsHref} utr={utr} />}
			placement={placement}
			className="w-fit"
			contentClassName="p-2.5 sm:p-3"
			// An impression is the card being seen: hovered open on desktop, tapped open on touch.
			onOpen={() => trackUmamiEvent('token-rights-impression', { entity: name })}
			render={<button type="button" />}
		>
			<TokenRightsPieChart tones={getTokenRightsPieTones(rights)} showLabels={false} className="size-7 shrink-0" />
		</Hovercard>
	)
}
