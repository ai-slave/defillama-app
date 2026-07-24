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
import { truncateAddress } from '~/utils'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { formatUsd } from '~/utils/numberFormat'

type BridgeAddressesTableRow = {
	address: string
	deposited?: number
	withdrawn?: number
	txs?: number
}
const columnHelper = createColumnHelper<BridgeAddressesTableRow>()

export function BridgeAddressesTable({ data }: { data: BridgeAddressesTableRow[] }) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'withdrawn', desc: true }])
	const { data: blockExplorersData } = useBlockExplorers()

	const columns = React.useMemo(
		() => [
			columnHelper.accessor('address', {
				header: 'Address',
				cell: ({ getValue }) => {
					const value = getValue()
					if (!value) return 'Not found'

					const formattedValue = value.split(':')[1] ?? value
					const explorer = getBlockExplorerNew({
						apiResponse: blockExplorersData ?? [],
						address: value,
						urlType: 'address'
					})
					const truncatedValue = truncateAddress(formattedValue)

					if (!explorer) {
						return <span className="truncate">{truncatedValue}</span>
					}

					return (
						<a href={explorer.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
							<span className="truncate">{truncatedValue}</span>
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
				cell: ({ row }) =>
					getBlockExplorerNew({
						apiResponse: blockExplorersData ?? [],
						address: row.original.address,
						urlType: 'address'
					})?.chainDisplayName ?? null,
				meta: {
					headerClassName: 'w-[120px]',
					align: 'end'
				}
			}),
			columnHelper.accessor('deposited', {
				header: 'Deposited',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[120px]',
					align: 'end'
				}
			}),
			columnHelper.accessor('withdrawn', {
				header: 'Withdrawn',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[120px]',
					align: 'end'
				}
			}),
			columnHelper.accessor('txs', {
				header: 'Total Transactions',
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
