import type { ColumnDef, Row, Table } from '@tanstack/react-table'
import { BasicLink } from '~/components/Link'
import type { paginatedTableFeatures } from '~/components/Table/features/pagination'
import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'
import { Logo } from '~/ui/Logo'
import { slug } from '~/utils'
import { formatUsd } from '~/utils/numberFormat'

const ranksBySortedRows = new WeakMap<
	ReadonlyArray<Row<typeof paginatedTableFeatures, ProtocolTokenUsageData>>,
	ReadonlyMap<string, number>
>()

function getSortedRowIndex(table: Table<typeof paginatedTableFeatures, ProtocolTokenUsageData>, rowId: string): number {
	const sortedRows = table.getSortedRowModel().rows
	let ranks = ranksBySortedRows.get(sortedRows)
	if (!ranks) {
		const nextRanks = new Map<string, number>()
		for (const [index, row] of sortedRows.entries()) nextRanks.set(row.id, index)
		ranks = nextRanks
		ranksBySortedRows.set(sortedRows, ranks)
	}
	const index = ranks.get(rowId)
	if (index === undefined) throw new Error(`Missing sorted token-usage row: ${rowId}`)
	return index
}

export const getColumns = (
	tokenSymbols: Array<string>
): Array<ColumnDef<typeof paginatedTableFeatures, ProtocolTokenUsageData>> => {
	const isMultiToken = tokenSymbols.length > 1

	const baseColumns: Array<ColumnDef<typeof paginatedTableFeatures, ProtocolTokenUsageData>> = [
		{
			header: 'Protocol',
			accessorKey: 'name',
			enableSorting: false,
			cell: ({ row, table }) => {
				const value = row.original.name
				const index = row.depth === 0 ? getSortedRowIndex(table, row.id) : row.index

				return (
					<div className="flex items-center gap-2">
						<span className="min-w-[30px] shrink-0 label-md text-tertiary">{index + 1}</span>
						<Logo size={24} src={row.original.logo} alt={`Logo of ${value}`} data-lgonly />
						<BasicLink href={`/protocol/${slug(value)}`} className="label-md text-link hover:underline">
							{value}
						</BasicLink>
					</div>
				)
			}
		},
		{
			header: 'Category',
			accessorKey: 'category',
			enableSorting: false,
			cell: ({ row }) => {
				const value = row.original.category
				return <span className="label-sm text-primary">{value || 'Unknown'}</span>
			}
		}
	]

	if (isMultiToken) {
		for (const symbol of tokenSymbols) {
			baseColumns.push({
				header: symbol.toUpperCase(),
				accessorFn: (row) => row.tokens[symbol] ?? 0,
				cell: ({ row }) => {
					const value = row.original.tokens[symbol] ?? 0
					return value > 0 ? (
						<span className="label-md">
							{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
						</span>
					) : (
						<span className="body-md text-tertiary">-</span>
					)
				},
				meta: {
					align: 'end'
				}
			})
		}
	}

	baseColumns.push({
		header: isMultiToken ? 'Total Amount' : 'Token Amount',
		id: 'amountUsd',
		accessorFn: (row) => row.amountUsd ?? undefined,
		cell: ({ row }) => {
			const value = row.original.amountUsd
			return (
				<span className="title-md">
					{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
				</span>
			)
		},
		meta: {
			align: 'end'
		}
	})

	return baseColumns
}
