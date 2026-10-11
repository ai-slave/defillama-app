import { createColumnHelper, type Row } from '@tanstack/react-table'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Logo } from '~/ui/Logo'
import { Tag } from '~/ui/Tag'
import { TextLink } from '~/ui/TextLink'
import type { tableFeaturesConfig } from './index'
import type { RewardLifecycle, RewardProgram } from './types'

export const lifecycleStyles: Record<RewardLifecycle, string> = {
	Live: 'text-success',
	Upcoming: 'text-link',
	'Season Gap': 'text-warning',
	Ended: 'text-secondary',
	Unknown: 'text-tertiary'
}
const helper = createColumnHelper<typeof tableFeaturesConfig, RewardProgram>()

// Widths follow "Column widths" in src/components/Table/README.md: 24px padding + max(header + 14px sort,
// widest realistic body).
export const columns = helper.columns([
	helper.accessor('protocol', {
		header: 'Protocol / Program',
		meta: { headerClassName: 'w-[300px] min-w-[300px]' },
		cell: ({ row }) => (
			<div className="flex items-center gap-2">
				<Button
					size="md"
					variant="ghost"
					square
					type="button"
					aria-label={`Details for ${row.original.protocol}${row.original.programName ? ` — ${row.original.programName}` : ''}`}
					aria-expanded={row.getIsExpanded()}
					aria-controls={row.getIsExpanded() ? `reward-details-${row.id}` : undefined}
					onClick={row.getToggleExpandedHandler()}
				>
					<Icon name={row.getIsExpanded() ? 'chevron-down' : 'chevron-right'} className="size-4" aria-hidden="true" />
				</Button>
				<Logo src={row.original.logo} size={28} />
				<div className="flex min-w-0 flex-col gap-0.5">
					{row.original.protocolHref ? (
						<TextLink
							href={row.original.protocolHref}
							data-reward-protocol-id={row.original.programId}
							data-reward-project-path={row.original.projectPath ?? undefined}
						>
							{row.original.protocol}
						</TextLink>
					) : (
						<span className="label-md text-primary">{row.original.protocol}</span>
					)}
					{row.original.programName ? (
						<span className="truncate body-sm text-secondary">{row.original.programName}</span>
					) : null}
					{row.original.category ? <span className="body-xs text-tertiary">{row.original.category}</span> : null}
				</div>
			</div>
		)
	}),
	helper.accessor((row) => (row.benefitAudience === 'Referrer only' ? '' : row.visitorBenefit), {
		id: 'primaryBenefit',
		header: 'What you get',
		enableSorting: false,
		// The page's primary content, so it takes the width the viewport can spare.
		// Two clamped lines rather than one truncated one: at 520px that shows the
		// whole benefit for nearly every program while still bounding row height.
		// The expanded row always carries the full copy, because a clipped cell reveals nothing on hover
		// ("Column widths" in src/components/Table/README.md).
		meta: {
			headerClassName: 'w-[320px] min-w-[320px] xl:w-[420px] xl:min-w-[420px] 2xl:w-[520px] 2xl:min-w-[520px]'
		},
		cell: ({ getValue }) => <span className="line-clamp-2 text-secondary">{getValue()}</span>
	}),
	helper.accessor('rewardTypes', {
		header: 'Reward Type',
		enableSorting: false,
		meta: { headerClassName: 'w-[240px] min-w-[240px]' },
		cell: ({ getValue }) =>
			getValue().length > 0 ? (
				<div className="flex flex-wrap gap-1">
					{getValue().map((type) => (
						<Tag key={type}>{type}</Tag>
					))}
				</div>
			) : (
				<span className="text-tertiary" title="Reward type not specified">
					—
				</span>
			)
	}),
	helper.accessor('lifecycle', {
		header: 'Status',
		meta: { headerClassName: 'w-[116px] min-w-[116px]' },
		cell: ({ row, getValue }) => (
			<div className="flex flex-col items-start gap-1">
				<span className={`inline-flex items-center gap-1.5 label-sm ${lifecycleStyles[getValue()]}`}>
					<span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
					{getValue()}
				</span>
				{/* Verified is the norm; only the exception carries information per row. */}
				{row.original.verification === 'Unverified' ? <span className="body-xs text-tertiary">Unverified</span> : null}
			</div>
		)
	}),
	helper.accessor((row) => row.sortDate ?? undefined, {
		id: 'dates',
		header: 'Dates',
		sortUndefined: 'last',
		sortFn: 'text',
		meta: { headerClassName: 'w-[173px] min-w-[173px]' },
		cell: ({ row }) =>
			row.original.dateRangeLabel ? <span className="text-secondary">{row.original.dateRangeLabel}</span> : null
	}),
	helper.display({
		id: 'link',
		header: 'Link',
		meta: { headerClassName: 'w-[100px] min-w-[100px]' },
		cell: ({ row }) =>
			row.original.referralUrl ? (
				<ExternalLinkButton
					href={row.original.referralUrl}
					data-reward-program-id={row.original.programId}
					data-reward-placement="table"
					data-reward-project-path={row.original.projectPath ?? undefined}
					rel="noopener noreferrer sponsored"
					aria-label={`Open ${row.original.protocol}${row.original.programName ? ` ${row.original.programName}` : ''} program`}
				>
					Open
				</ExternalLinkButton>
			) : (
				<span className="text-tertiary">—</span>
			)
	})
])

export function renderProgramDetails(row: Row<typeof tableFeaturesConfig, RewardProgram>) {
	const program = row.original
	return (
		<div id={`reward-details-${row.id}`} className="flex flex-col gap-4 bg-surface-elevated-1 p-4">
			{/* Bounded by the content measure, not the panel: the panel is as wide as the
			    table, so anything pushed to its right edge sits outside the scroller. */}
			<div className="flex max-w-[72ch] items-start gap-4">
				<p className="body-sm text-tertiary">{program.summary}</p>
				{program.lastVerified ? (
					<span className="ml-auto shrink-0 body-xs text-tertiary">Verified {program.lastVerified}</span>
				) : null}
			</div>
			<dl className="flex max-w-[72ch] flex-col gap-3">
				<div>
					<dt className="label-sm text-secondary">For invited users</dt>
					<dd className="mt-1 body-md text-primary">{program.visitorBenefit}</dd>
				</div>
				{program.referrerBenefit ? (
					<div>
						<dt className="label-sm text-secondary">For users who invite others</dt>
						<dd className="mt-1 body-md text-primary">{program.referrerBenefit}</dd>
					</div>
				) : null}
			</dl>
			{program.sources.length > 0 ? (
				<div className="flex flex-wrap items-center gap-2">
					{program.sources.map((source) => (
						<ExternalLinkButton key={source.url} href={source.url}>
							{source.label}
						</ExternalLinkButton>
					))}
				</div>
			) : null}
		</div>
	)
}
