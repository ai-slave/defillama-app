import { BasicLink } from '~/components/Link'
import { utrGradeColor } from '~/containers/UniversalTokenRating/gradeBands'
import { GradeBadge } from '~/containers/UniversalTokenRating/grades'
import { Change } from '~/ui/Change'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatDate } from '~/utils/dateFormat'
import { formatNumber } from '~/utils/numberFormat'
import { getUtrFacts, type TokenRightsLink, type TokenRightsUtrSummary } from './badge'
import { TokenCardHeader, TokenCardLink } from './TokenCardHeader'
import { TokenRightsPieChart } from './TokenRightsPieChart'
import type { TokenRightsPreview } from './types'
import { getTokenRightsPieTones } from './utils'

function RightsLink({ rights, href, entity }: { rights: TokenRightsPreview; href: string; entity: string }) {
	return (
		<TokenCardLink
			href={href}
			data-umami-event="token-rights-link"
			data-umami-event-card="utr"
			data-umami-event-entity={entity}
			aria-label="View token rights"
		>
			<span className="flex items-center gap-1.5">
				Rights
				<TokenRightsPieChart tones={getTokenRightsPieTones(rights)} showLabels={false} className="size-5 shrink-0" />
				<Icon name="arrow-right" className="size-3.5 text-link" />
			</span>
		</TokenCardLink>
	)
}

function formatScore(score: number): string {
	return formatNumber(score, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
}

function AxisRow({
	label,
	grade,
	score
}: {
	label: string
	grade: TokenRightsUtrSummary['disclosureGrade']
	score: number | null
}) {
	const fill = score == null ? 0 : Math.max(0, Math.min(100, score * 10))
	return (
		<div className="flex items-center gap-2">
			<span className="w-20 shrink-0 label-sm text-secondary">{label}</span>
			{/* No grade letter: keep the space instead of printing N/A. */}
			{grade ? <GradeBadge score={null} grade={grade} className="shrink-0" /> : <span className="w-10 shrink-0" />}
			<span aria-hidden className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-elevated-1">
				<span
					className={`block h-full rounded-full ${grade ? utrGradeColor(grade).solid : 'bg-border-strong'}`}
					style={{ width: `${fill}%` }}
				/>
			</span>
			<span className="w-14 shrink-0 text-right label-sm tabular-nums">
				{score == null ? 'N/A' : formatScore(score)}
				<span className="text-tertiary"> /10</span>
			</span>
		</div>
	)
}

export function UtrPopover({
	name,
	utr,
	rights
}: {
	/** The row's DefiLlama name, so both cards name the entity the same way. */
	name: string
	utr: TokenRightsUtrSummary
	rights: TokenRightsLink | null
}) {
	const facts = getUtrFacts(utr)

	return (
		// Width excludes the popover's padding.
		<div className="w-[min(22rem,calc(var(--popover-available-width)-1.5rem))] whitespace-normal text-primary">
			<div className="flex min-w-0 flex-col gap-2.5">
				<TokenCardHeader
					name={name}
					symbols={utr.symbol ? [utr.symbol] : []}
					title="Universal Token Rating"
					action={rights?.href ? <RightsLink rights={rights.preview} href={rights.href} entity={name} /> : null}
				/>

				<div className="flex items-center gap-3 rounded-md border border-subtle p-2">
					<GradeBadge score={null} grade={utr.grade} size="lg" className="shrink-0" />
					<div className="flex min-w-0 flex-col">
						<span className="label-xs tracking-wider text-tertiary uppercase">Overall score</span>
						<span className="flex items-baseline gap-2">
							<span className="mono-md-bold">{utr.score != null ? formatScore(utr.score) : 'N/A'}</span>
							<span className="label-xs text-tertiary">/ 100</span>
							{utr.momChangePct != null ? (
								<Tooltip content="Change over the last month" className="gap-1 label-sm text-tertiary tabular-nums">
									<Change value={utr.momChangePct} />
									MoM
								</Tooltip>
							) : null}
						</span>
					</div>
				</div>

				<div className="flex flex-col gap-1.5">
					<AxisRow label="Disclosure" grade={utr.disclosureGrade} score={utr.disclosureScore} />
					<AxisRow label="Performance" grade={utr.performanceGrade} score={utr.performanceScore} />
				</div>

				{facts.length > 0 || utr.asOf ? (
					<div className="flex flex-col gap-0.5 label-xs text-tertiary">
						{facts.length > 0 ? <p>{facts.join(' · ')}</p> : null}
						{utr.asOf ? <p>As of {formatDate(utr.asOf)}</p> : null}
					</div>
				) : null}

				<p className="label-xs text-tertiary">
					Disclosure: what the project publishes. Performance: whether market data backs it up.
				</p>

				<div className="flex justify-end">
					<BasicLink
						href={utr.href}
						data-umami-event="utr-link"
						data-umami-event-card="utr"
						data-umami-event-entity={name}
						className="inline-flex items-center gap-1 label-sm text-link hover:underline"
					>
						View full rating
						<Icon name="arrow-right" className="size-3.5" />
					</BasicLink>
				</div>
			</div>
		</div>
	)
}

export function UtrGradeHovercard({
	name,
	utr,
	rights
}: {
	name: string
	utr: TokenRightsUtrSummary
	rights: TokenRightsLink | null
}) {
	return (
		<Hovercard
			content={<UtrPopover name={name} utr={utr} rights={rights} />}
			placement="right-start"
			className={`h-5 w-fit min-w-8 justify-center rounded-sm px-1 label-xs font-semibold ${utrGradeColor(utr.grade).tinted} ${utrGradeColor(utr.grade).text}`}
			// An impression is the card being seen: hovered open on desktop, tapped open on touch.
			onOpen={() => trackUmamiEvent('utr-impression', { entity: name, grade: utr.grade })}
			render={<button type="button" aria-label={`Universal Token Rating ${utr.grade}`} />}
		>
			{utr.grade}
		</Hovercard>
	)
}
