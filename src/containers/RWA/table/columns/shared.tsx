import { createColumnHelper } from '@tanstack/react-table'
import { Fragment, type ReactNode } from 'react'
import { Hovercard } from '~/ui/Hovercard'
import { TextLink } from '~/ui/TextLink'
import { Definition, Tooltip } from '~/ui/Tooltip'
import { formatUsd } from '~/utils/numberFormat'
import type { RWAOverviewDisplayRow } from '../../api.types'
import { BreakdownTooltipContent } from '../../BreakdownTooltipContent'
import type { rwaTableFeatures } from '../features'
import type { RWAGroupDistinctKey, RWALeafRow, RWATableRow } from '../rows'

export const columnHelper = createColumnHelper<typeof rwaTableFeatures, RWATableRow>()

export const USD_FORMAT = { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' } as const

export function formatTableUsd(value: number | null | undefined): string | null {
	return value == null ? null : formatUsd(value, USD_FORMAT)
}

export function getLeafRow(row: RWATableRow): RWALeafRow | null {
	return row.kind === 'leaf' ? row : null
}

export function numberColumnMeta(help?: string, csvHeader?: string) {
	return {
		align: 'end' as const,
		...(help ? { headerHelperText: help } : {}),
		...(csvHeader ? { csvHeader } : {})
	}
}

export function textColumnMeta(help?: string, csvHeader?: string) {
	return {
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
		return unavailableReason ? <Definition content={unavailableReason}>{formatted}</Definition> : formatted
	}

	return (
		<Hovercard
			placement="right-start"
			content={<BreakdownTooltipContent breakdown={breakdown} description={description} />}
			width="md"
			definition
		>
			{formatted}
		</Hovercard>
	)
}

/** A value with its definition in a tooltip; without one, the tooltip holds the value a narrow column truncates. */
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
	return (
		<Tooltip
			content={definition || value}
			render={<span className={`inline-block max-w-full truncate ${className ?? ''}`} />}
		>
			{value}
		</Tooltip>
	)
}

/** Distinct child values, the full list in a tooltip; with `href`, each value that has a page is a link. */
export function DistinctListCell({
	values,
	className,
	href
}: {
	values: Array<string>
	className?: string
	href?: (value: string) => string | null
}) {
	if (values.length === 0) return null
	const text = values.join(', ')
	const content = href
		? values.map((value, index) => {
				const target = href(value)
				return (
					<Fragment key={value}>
						{index > 0 ? ', ' : null}
						{target ? (
							<TextLink href={target} className="whitespace-nowrap">
								{value}
							</TextLink>
						) : (
							value
						)}
					</Fragment>
				)
			})
		: text
	return values.length > 1 ? (
		<Tooltip content={text} render={<span className={`inline-block max-w-full truncate ${className ?? ''}`} />}>
			{content}
		</Tooltip>
	) : (
		<span className={`truncate ${className ?? ''}`.trim()}>{content}</span>
	)
}

/** Out of the table and the picker, in the export. */
export function asCsvOnly<T extends { meta?: object }>(column: T): T {
	return { ...column, meta: { ...column.meta, hidden: true, csvOnly: true } }
}

/**
 * How a group row fills a text column: `list` shows every distinct value of its children, `single` shows the value
 * only when one applies to the whole group and leaves the cell empty otherwise.
 */
export type RWAGroupTextFold = 'list' | 'single'

/**
 * A text column: a group row folds its children's distinct values, a leaf row shows its own. One value reads like a
 * leaf (`render` styles it), several read as a list. The accessor holds what the cell shows, so the sort and the
 * csv agree with the page.
 */
export function createDistinctTextColumn({
	id,
	header,
	pick,
	meta,
	fold = 'list',
	href,
	render
}: {
	id: RWAGroupDistinctKey
	header: string
	pick: (asset: RWAOverviewDisplayRow) => string | null | undefined
	meta: ReturnType<typeof textColumnMeta> & { headerClassName?: string }
	fold?: RWAGroupTextFold
	href?: (value: string) => string | null
	render?: (value: string) => ReactNode
}) {
	return columnHelper.accessor(
		(row) => {
			if (row.kind === 'leaf') return pick(row.asset) || undefined
			const values = row.distinct[id]
			if (fold === 'single') return values.length === 1 ? values[0] : undefined
			return values.join(', ') || undefined
		},
		{
			id,
			header,
			enableSorting: false,
			cell: ({ row, getValue }) => {
				if (row.original.kind === 'group' && fold === 'list') {
					const values = row.original.distinct[id]
					if (values.length > 1 || !render) return <DistinctListCell values={values} href={href} />
				}
				const value = getValue()
				if (!value) return null
				return render ? (
					render(value)
				) : (
					<Tooltip content={value} render={<span className="truncate" />}>
						{value}
					</Tooltip>
				)
			},
			meta
		}
	)
}
