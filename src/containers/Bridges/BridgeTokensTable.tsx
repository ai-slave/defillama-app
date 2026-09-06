import {
	createColumnHelper,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import * as React from 'react'
import { useBlockExplorers } from '~/api/client'
import { VirtualTable } from '~/components/Table/Table'
import { Icon } from '~/ui/Icon'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { formatUsd } from '~/utils/numberFormat'
import type { BridgeTokenTableRow } from './types'

const columnHelper = createColumnHelper<BridgeTokenTableRow>()

export function BridgeTokensTable({ data }: { data: Array<BridgeTokenTableRow> }) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'volume', desc: true }])
	const { data: blockExplorersData } = useBlockExplorers()

	const columns = React.useMemo(
		() => [
			columnHelper.accessor('symbol', {
				header: 'Token',
				cell: ({ getValue, row }) => {
					const symbol = getValue()
					const token = row.original.token
					if (!symbol) return 'Not found'
					const explorer = token
						? getBlockExplorerNew({
								apiResponse: blockExplorersData ?? [],
								address: token,
								urlType: 'token'
							})
						: null

					if (!explorer) {
						return <span className="truncate">{symbol}</span>
					}

					return (
						<a href={explorer.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
							<span className="truncate">{symbol}</span>
							<Icon name="external-link" height={10} width={10} />
						</a>
					)
				},
				meta: {
					headerClassName: 'w-[120px]'
				}
			}),
			columnHelper.display({
				id: 'chainName',
				header: 'Chain',
				cell: ({ row }) => {
					const token = row.original.token
					if (!token) return null

					return (
						getBlockExplorerNew({
							apiResponse: blockExplorersData ?? [],
							address: token,
							urlType: 'token'
						})?.chainDisplayName ?? null
					)
				},
				meta: {
					headerClassName: 'w-[120px]',
					align: 'end'
				}
			}),
			columnHelper.accessor((row) => row.deposited ?? undefined, {
				id: 'deposited',
				header: 'Deposited',
				cell: (info) =>
					info.getValue() == null
						? null
						: formatUsd(info.getValue(), {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							}),
				meta: {
					headerClassName: 'w-[120px]',
					align: 'end'
				}
			}),
			columnHelper.accessor((row) => row.withdrawn ?? undefined, {
				id: 'withdrawn',
				header: 'Withdrawn',
				cell: (info) =>
					info.getValue() == null
						? null
						: formatUsd(info.getValue(), {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							}),
				meta: {
					headerClassName: 'w-[120px]',
					align: 'end'
				}
			}),
			columnHelper.accessor((row) => row.volume ?? undefined, {
				id: 'volume',
				header: 'Total Volume',
				cell: (info) =>
					info.getValue() == null
						? null
						: formatUsd(info.getValue(), {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							}),
				meta: {
					headerClassName: 'w-[120px]',
					align: 'end'
				}
			})
		],
		[blockExplorersData]
	)

	const instance = useReactTable({
		data,
		columns,
		state: {
			sorting
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
	})

	return <VirtualTable instance={instance} />
}
