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

type BridgeTokensTableRow = {
	symbol: string
	deposited?: number
	withdrawn?: number
	volume?: number
}

const columnHelper = createColumnHelper<BridgeTokensTableRow>()

export function BridgeTokensTable({ data }: { data: BridgeTokensTableRow[] }) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'volume', desc: true }])
	const { data: blockExplorersData } = useBlockExplorers()

	const columns = React.useMemo(
		() => [
			columnHelper.accessor('symbol', {
				header: 'Token',
				cell: ({ getValue }) => {
					const value = getValue()
					if (!value) return 'Not found'

					const [symbol, token] = value.split('#')
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
					const [, token] = row.original.symbol.split('#')
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
			columnHelper.accessor('deposited', {
				header: 'Deposited',
				cell: (info) =>
					formatUsd(info.getValue() ?? 0, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					}),
				meta: {
					headerClassName: 'w-[120px]',
					align: 'end'
				}
			}),
			columnHelper.accessor('withdrawn', {
				header: 'Withdrawn',
				cell: (info) =>
					formatUsd(info.getValue() ?? 0, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					}),
				meta: {
					headerClassName: 'w-[120px]',
					align: 'end'
				}
			}),
			columnHelper.accessor('volume', {
				header: 'Total Volume',
				cell: (info) =>
					formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
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
