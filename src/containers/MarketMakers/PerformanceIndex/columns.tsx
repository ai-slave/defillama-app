import { createColumnHelper } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import type { SortedTableFeatures } from '~/components/Table/features/sorting'
import { TokenLogo } from '~/components/TokenLogo'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { StatusBadge } from '~/ui/StatusBadge'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber } from '~/utils/numberFormat'
import { GradeBadge, integrationStatus } from '../badges'
import { formatComposite, resolveGrade } from '../format'
import { GRADE_SCALE_SUMMARY } from '../gradeBands'
import type { IntegrationStatus, PerformanceRow } from './types'

const columnHelper = createColumnHelper<SortedTableFeatures, PerformanceRow>()

interface IBuildPerformanceColumns {
	onSelectMM: (marketMakerId: string, marketMakerName: string) => void
	rankById: Map<string, number>
}

const SCORE_TOOLTIPS = {
	composite:
		'Weighted average of all performance categories. A higher score indicates better overall performance across trading, trust, coverage, uptime and integration.',
	grade: `A simplified letter rating that reflects a market maker’s overall standing on the leaderboard. Grades are derived from the composite score and are designed to make performance easier to interpret without relying solely on individual numerical scores. ${GRADE_SCALE_SUMMARY}`,
	tradingKpis:
		"Score derived from the market maker's rank on the aggregated leaderboard, reflecting depth and volume performance relative to peers.",
	trustIntegration:
		"Measured the market maker's data-sharing relationship with Forgd, including invitation acceptance, data drops, active engagements, and reporting",
	coverageCapabilities:
		'Reflects the breadth of exchange coverage and service offerings. Currently scored based on supported CEXs, DEXs, and service types.',
	uptime:
		"Score derived from the market maker's rank on the KPI adherence leaderboard, measuring consistency, and reliability of market making operations.",
	integrationLevel:
		'Indicates how deeply the market maker is integrated with the Forgd platform, from no account to full-sharing engagement.'
} as const

function TooltipMark({ glyph, content }: { glyph: string; content: string }) {
	return (
		<Tooltip content={content}>
			<span className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full bg-brand label-xs text-on-brand">
				{glyph}
			</span>
		</Tooltip>
	)
}

function HeaderWithTooltip({ label, tooltip, glyph = '?' }: { label: string; tooltip: string; glyph?: string }) {
	return (
		<span className="flex items-center gap-1 whitespace-nowrap">
			{label}
			<TooltipMark glyph={glyph} content={tooltip} />
		</span>
	)
}

function renderScore(value: number | null) {
	if (value == null) return <span className="text-tertiary">N/A</span>
	return <span>{formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
}

function renderComposite(value: number | null) {
	if (value == null) return <span className="text-tertiary">N/A</span>
	return <span>{formatComposite(value)}</span>
}

const buildScoreColumn = (
	onSelectMM: IBuildPerformanceColumns['onSelectMM'],
	id: keyof Pick<PerformanceRow, 'composite' | 'tradingKpis' | 'trustIntegration' | 'coverageCapabilities' | 'uptime'>,
	label: string,
	tooltip: string,
	render: (value: number | null) => ReactNode = renderScore
) =>
	columnHelper.accessor((row) => row[id] ?? undefined, {
		id,
		header: () => <HeaderWithTooltip label={label} tooltip={tooltip} />,
		cell: ({ row }) => (
			<button
				type="button"
				onClick={() => onSelectMM(row.original.marketMakerId, row.original.marketMakerName)}
				className="-mx-1 rounded-sm px-1 hover:bg-surface-elevated-2"
			>
				{render(row.original[id])}
			</button>
		),
		sortUndefined: 'last',
		meta: { align: 'start' }
	})

export function buildPerformanceColumns({ onSelectMM, rankById }: IBuildPerformanceColumns) {
	const rankColumn = columnHelper.accessor((row) => row.composite ?? undefined, {
		id: '#',
		header: '#',
		cell: ({ row }) => rankById.get(row.original.marketMakerId) ?? '',
		sortUndefined: 'last',
		meta: { align: 'center' }
	})

	const marketMakerColumn = columnHelper.display({
		id: 'marketMaker',
		header: 'Market Maker',
		cell: ({ row }) => (
			<button
				type="button"
				onClick={() => onSelectMM(row.original.marketMakerId, row.original.marketMakerName)}
				className="flex items-center gap-2 text-link hover:underline"
			>
				<TokenLogo src={row.original.marketMakerImageUrl} size={24} />
				<span className="truncate">{row.original.marketMakerName}</span>
			</button>
		),
		enableSorting: false,
		meta: { cellClassName: 'truncate' }
	})

	const gradeColumn = columnHelper.accessor((row) => row.composite ?? undefined, {
		id: 'grade',
		header: () => <HeaderWithTooltip label="Grade" tooltip={SCORE_TOOLTIPS.grade} />,
		cell: ({ row }) => <GradeBadge grade={resolveGrade(row.original.composite)} />,
		sortUndefined: 'last',
		meta: { align: 'start' }
	})

	const integrationLevelColumn = columnHelper.accessor((row) => row.integrationLevel ?? undefined, {
		id: 'integrationLevel',
		header: () => <HeaderWithTooltip label="Integration Level" tooltip={SCORE_TOOLTIPS.integrationLevel} glyph="i" />,
		cell: ({ row }) => (
			<div className="flex items-center gap-2">
				{renderStatusBadge(row.original.integrationStatus)}
				<Button
					type="button"
					size="md"
					onClick={() => onSelectMM(row.original.marketMakerId, row.original.marketMakerName)}
				>
					Details
					<Icon name="arrow-right" className="size-3" />
				</Button>
			</div>
		),
		sortUndefined: 'last',
		meta: { align: 'start' }
	})

	return columnHelper.columns([
		rankColumn,
		marketMakerColumn,
		gradeColumn,
		buildScoreColumn(onSelectMM, 'composite', 'Composite Score', SCORE_TOOLTIPS.composite, renderComposite),
		buildScoreColumn(onSelectMM, 'tradingKpis', 'Trading KPIs', SCORE_TOOLTIPS.tradingKpis),
		buildScoreColumn(onSelectMM, 'trustIntegration', 'Trust', SCORE_TOOLTIPS.trustIntegration),
		buildScoreColumn(
			onSelectMM,
			'coverageCapabilities',
			'Coverage & Capabilities',
			SCORE_TOOLTIPS.coverageCapabilities
		),
		buildScoreColumn(onSelectMM, 'uptime', 'Uptime', SCORE_TOOLTIPS.uptime),
		integrationLevelColumn
	])
}

const STATUS_LABELS: Record<'full' | 'partial' | 'none', string> = {
	full: 'Full',
	partial: 'Partial',
	none: 'None'
}

function renderStatusBadge(status: IntegrationStatus) {
	const label = STATUS_LABELS[status as 'full' | 'partial' | 'none'] ?? String(status)
	// The fixed slot keeps the Details buttons in one column whatever the label's width.
	return (
		<span className="w-[92px] shrink-0">
			<StatusBadge status={integrationStatus(status)}>{label}</StatusBadge>
		</span>
	)
}
