import {
	createColumnHelper,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import { startTransition, useMemo, useState } from 'react'
import { useBlockExplorers } from '~/api/client'
import type { BlockExplorersResponse } from '~/api/types'
import { Icon } from '~/components/Icon'
import { VirtualTable } from '~/components/Table/Table'
import { Hovercard } from '~/ui/Hovercard'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { formattedNum, truncateAddress } from '~/utils'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import type { Insider } from './api.types'

const columnHelper = createColumnHelper<Insider>()

const formatAllocationLabel = (value: string) =>
	value
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.split(' ')
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')

const getColumns = (blockExplorersData: BlockExplorersResponse, tokenChain: string | null) => [
	columnHelper.accessor('address', {
		header: 'Address',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const address = getValue()
			const displayAddress = address.split(':')[1] ?? address
			const shortAddress = truncateAddress(displayAddress)
			const chainId = address.includes(':') ? address.split(':')[0] : tokenChain
			const explorer = chainId
				? getBlockExplorerNew({ apiResponse: blockExplorersData, address: displayAddress, chainId, urlType: 'address' })
				: null
			return (
				<span className="flex flex-col" title={displayAddress}>
					{row.original.label ? <span>{row.original.label}</span> : null}
					{explorer ? (
						<a
							href={explorer.url}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-1 font-mono text-tertiary hover:underline"
						>
							{shortAddress}
							<Icon name="external-link" height={10} width={10} />
						</a>
					) : (
						<span className="font-mono text-tertiary">{shortAddress}</span>
					)}
				</span>
			)
		},
		size: 200
	}),
	columnHelper.accessor(
		(row) =>
			(row.allocations ?? [])
				.map((a) => a.allocationSection)
				.filter(Boolean)
				.join(', '),
		{
			id: 'allocations',
			header: 'Allocation',
			enableSorting: false,
			cell: ({ row }) => {
				const allocations = row.original.allocations ?? []
				const sections = Array.from(new Set(allocations.map((a) => a.allocationSection).filter(Boolean)))
				if (allocations.length === 0) return <span>{sections.join(', ')}</span>
				return (
					<Hovercard
						className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
						content={
							<span className="flex flex-col gap-1">
								{allocations.map((a, index) => (
									<span key={`${a.category}-${index}`} className="flex items-center justify-between gap-4">
										<span>
											{a.allocationSection ?? formatAllocationLabel(a.category)} ({formatAllocationLabel(a.category)})
										</span>
										<span className="font-medium">{formattedNum(a.received)}</span>
									</span>
								))}
							</span>
						}
					>
						{sections.join(', ')}
					</Hovercard>
				)
			},
			size: 200
		}
	),
	columnHelper.accessor('received', {
		header: 'Received',
		cell: ({ getValue }) => formattedNum(getValue()),
		meta: { align: 'end' },
		size: 140
	}),
	columnHelper.accessor('balance', {
		header: 'Balance',
		cell: ({ getValue }) => formattedNum(getValue()),
		meta: { align: 'end' },
		size: 140
	}),
	columnHelper.accessor('staked', {
		header: 'Staked',
		cell: ({ getValue }) => formattedNum(getValue()),
		meta: { align: 'end' },
		size: 140
	}),
	columnHelper.accessor('transferredOut', {
		header: 'Transferred Out',
		cell: ({ getValue }) => formattedNum(getValue()),
		meta: { align: 'end' },
		size: 160
	})
]

export const InsidersTable = ({
	insiders,
	methodology,
	token
}: {
	insiders: Insider[]
	methodology: string
	token?: string | null
}) => {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'received', desc: true }])
	const { data: blockExplorersData } = useBlockExplorers()
	const tokenChain = useMemo(() => {
		const chain = token?.includes(':') ? token.split(':')[0] : null
		return chain && chain !== 'coingecko' ? chain : null
	}, [token])
	const columns = useMemo(() => {
		const cols = getColumns(blockExplorersData ?? [], tokenChain)
		const hasAllocations = insiders.some((insider) =>
			insider.allocations?.some((allocation) => allocation.allocationSection)
		)
		return hasAllocations ? cols : cols.filter((col) => col.id !== 'allocations')
	}, [blockExplorersData, tokenChain, insiders])

	const instance = useReactTable({
		data: insiders,
		columns,
		state: { sorting },
		enableSortingRemoval: false,
		onSortingChange: (updater) => startTransition(() => setSorting(updater)),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
	})

	return (
		<Panel padding="none">
			<PanelHeader className="flex-col items-start gap-1">
				<PanelTitle as="h3">Insiders</PanelTitle>
				{methodology ? <p className="text-sm text-secondary">{methodology}</p> : null}
			</PanelHeader>
			<div className="max-h-100 overflow-y-auto">
				<VirtualTable instance={instance} stripedBg skipVirtualization />
			</div>
		</Panel>
	)
}
