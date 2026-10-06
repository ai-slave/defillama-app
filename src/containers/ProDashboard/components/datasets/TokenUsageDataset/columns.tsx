import type { ColumnDef, Row, Table } from '@tanstack/react-table'
import { BasicLink } from '~/components/Link'
import type { paginatedTableFeatures } from '~/components/Table/features/pagination'
import { TokenLogo } from '~/components/TokenLogo'
import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'
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
						<span className="min-w-[30px] shrink-0 text-sm font-medium text-pro-text-tertiary">{index + 1}</span>
						<TokenLogo src={row.original.logo} alt={`Logo of ${value}`} data-lgonly />
						<BasicLink href={`/protocol/${slug(value)}`} className="text-sm font-medium text-link hover:underline">
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
				return <span className="text-xs font-medium text-pro-text-primary">{value || 'Unknown'}</span>
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
						<span className="text-sm font-medium">
							{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
						</span>
					) : (
						<span className="text-sm text-pro-text-tertiary">-</span>
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
				<span className="text-sm font-semibold">
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
