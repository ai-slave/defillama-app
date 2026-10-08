import { createColumnHelper } from '@tanstack/react-table'
import { Hovercard } from '~/ui/Hovercard'
import { Tooltip } from '~/ui/Tooltip'
import { formatPercentChange, formatUsd } from '~/utils/numberFormat'
import { BreakdownTooltipContent } from '../../BreakdownTooltipContent'
import type { rwaTableFeatures } from '../features'
import type { RWALeafRow, RWATableRow } from '../rows'

export const columnHelper = createColumnHelper<typeof rwaTableFeatures, RWATableRow>()

export const USD_FORMAT = { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' } as const

export function formatTableUsd(value: number | null | undefined): string | null {
	return value == null ? null : formatUsd(value, USD_FORMAT)
}

export function getLeafRow(row: RWATableRow): RWALeafRow | null {
	return row.kind === 'leaf' ? row : null
}

export function numberColumnMeta(width: string, help?: string, csvHeader?: string) {
	return {
		headerClassName: width,
		align: 'end' as const,
		...(help ? { headerHelperText: help } : {}),
		...(csvHeader ? { csvHeader } : {})
	}
}

export function textColumnMeta(width: string, help?: string, csvHeader?: string) {
	return {
		headerClassName: width,
		align: 'end' as const,
		...(help ? { headerHelperText: help } : {}),
		...(csvHeader ? { csvHeader } : {})
	}
}

/** A USD value with its breakdown hovercard; a null breakdown cannot be split. */
export function UsdBreakdownCell({
	value,
	breakdown,
	unavailableReason,
	description
}: {
	value: number | null | undefined
	breakdown: Array<[string, number]> | null | undefined
	unavailableReason?: string
	description: string
}) {
	const formatted = formatTableUsd(value)
	if (formatted == null) return null

	if (!breakdown || breakdown.length === 0) {
		return unavailableReason ? (
			<Tooltip content={unavailableReason} className="underline decoration-dotted">
				{formatted}
			</Tooltip>
		) : (
			formatted
		)
	}

	return (
		<Hovercard
			placement="right-start"
			content={<BreakdownTooltipContent breakdown={breakdown} description={description} />}
			contentClassName="w-80 max-w-(--popover-available-width) p-3 whitespace-normal"
			className="underline decoration-dotted"
		>
			{formatted}
		</Hovercard>
	)
}

export function ChangeCell({ value }: { value: number | null | undefined }) {
	const formatted = formatPercentChange(value)
	if (formatted == null) return null
	const tone = value > 0 ? 'text-data-up' : value < 0 ? 'text-data-down' : 'text-primary'
	return <span className={tone}>{formatted}</span>
}

/** A value with its definition in a tooltip. */
export function DefinedValueCell({
	value,
	definition,
	className
}: {
	value: string | null | undefined
	definition: string | undefined
	className?: string
}) {
	if (!value) return null
	if (definition) {
		return (
			<Tooltip content={definition} render={<span className={`inline-block max-w-full truncate ${className ?? ''}`} />}>
				{value}
			</Tooltip>
		)
	}
	return (
		<span className={`inline-block max-w-full truncate ${className ?? ''}`} title={value}>
			{value}
		</span>
	)
}

/** Distinct child values, the full list in a tooltip. */
export function DistinctListCell({ values, className }: { values: Array<string>; className?: string }) {
	if (values.length === 0) return null
	const text = values.join(', ')
	return values.length > 1 ? (
		<Tooltip content={text} render={<span className={`inline-block max-w-full truncate ${className ?? ''}`} />}>
			{text}
		</Tooltip>
	) : (
		<span className={`truncate ${className ?? ''}`.trim()}>{text}</span>
	)
}

/** Out of the table and the picker, in the export. */
export function asCsvOnly<T extends { meta?: object }>(column: T): T {
	return { ...column, meta: { ...column.meta, hidden: true, csvOnly: true } }
}
