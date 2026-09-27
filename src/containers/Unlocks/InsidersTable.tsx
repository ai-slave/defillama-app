import { createColumnHelper, type SortingState, useTable } from '@tanstack/react-table'
import { startTransition, useMemo, useState } from 'react'
import { useBlockExplorers } from '~/api/client'
import type { BlockExplorersResponse } from '~/api/types'
import { displayTableFeatures } from '~/components/Table/features/display'
import { Table } from '~/components/Table/Table'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { truncateAddress } from '~/utils'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
import { formatCompactNumber } from '~/utils/numberFormat'
import type { Insider } from './api.types'

const tableFeaturesConfig = displayTableFeatures

const columnHelper = createColumnHelper<typeof tableFeaturesConfig, Insider>()

const formatAllocationLabel = (value: string) =>
	value
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.split(' ')
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')

const getColumns = (blockExplorersData: BlockExplorersResponse, tokenChain: string | null) =>
	columnHelper.columns([
		columnHelper.accessor('address', {
			header: 'Address',
			enableSorting: false,
			cell: ({ getValue, row }) => {
				const address = getValue()
				const displayAddress = address.split(':')[1] ?? address
				const shortAddress = truncateAddress(displayAddress)
				const chainId = address.includes(':') ? address.split(':')[0] : tokenChain
				const explorer = chainId
					? getBlockExplorerNew({
							apiResponse: blockExplorersData,
							address: displayAddress,
							chainId,
							urlType: 'address'
						})
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
			meta: { headerClassName: 'w-[200px] min-w-[200px]' }
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
							className="max-w-full"
							contentClassName="w-80 max-w-(--popover-available-width) p-3"
							content={
								<span className="flex flex-col gap-1">
									{keyedOccurrences(allocations, (a) => JSON.stringify([a.category, a.allocationSection])).map(
										({ item: a, key }) => (
											<span key={key} className="flex items-center justify-between gap-4">
												<span className="min-w-0 break-words">
													{a.allocationSection ?? formatAllocationLabel(a.category)} (
													{formatAllocationLabel(a.category)})
												</span>
												<span className="shrink-0 font-medium">
													{formatCompactNumber(a.received, {
														minimumCompactValue: 1_000_000,
														compactSuffix: 'lowercase'
													})}
												</span>
											</span>
										)
									)}
								</span>
							}
						>
							<span className="truncate">{sections.join(', ')}</span>
						</Hovercard>
					)
				},
				meta: { headerClassName: 'w-[200px] min-w-[200px]' }
			}
		),
		columnHelper.accessor((row) => row.received ?? undefined, {
			id: 'received',
			header: 'Received',
			cell: ({ getValue }) =>
				formatCompactNumber(getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
			meta: { headerClassName: 'w-[140px] min-w-[140px]', align: 'end' }
		}),
		columnHelper.accessor((row) => row.balance ?? undefined, {
			id: 'balance',
			header: 'Balance',
			cell: ({ getValue }) =>
				formatCompactNumber(getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
			meta: { headerClassName: 'w-[140px] min-w-[140px]', align: 'end' }
		}),
		columnHelper.accessor((row) => row.staked ?? undefined, {
			id: 'staked',
			header: 'Staked',
			cell: ({ getValue }) =>
				formatCompactNumber(getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
			meta: { headerClassName: 'w-[140px] min-w-[140px]', align: 'end' }
		}),
		columnHelper.accessor((row) => row.transferredOut ?? undefined, {
			id: 'transferredOut',
			header: 'Transferred Out',
			cell: ({ getValue }) =>
				formatCompactNumber(getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
			meta: { headerClassName: 'w-[160px] min-w-[160px]', align: 'end' }
		})
	])

export function InsidersTable({
	insiders,
	methodology,
	token
}: {
	insiders: Array<Insider>
	methodology: string
	token?: string | null
}) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'received', desc: true }])
	const { data: blockExplorersData } = useBlockExplorers()
	const tokenChainValue = token?.includes(':') ? token.split(':')[0] : null
	const tokenChain = tokenChainValue && tokenChainValue !== 'coingecko' ? tokenChainValue : null
	const columns = useMemo(() => {
		const cols = getColumns(blockExplorersData ?? [], tokenChain)
		const hasAllocations = insiders.some((insider) =>
			insider.allocations?.some((allocation) => allocation.allocationSection)
		)
		return hasAllocations ? cols : cols.filter((col) => col.id !== 'allocations')
	}, [blockExplorersData, tokenChain, insiders])

	const instance = useTable({
		features: tableFeaturesConfig,
		defaultColumn: { sortUndefined: 'last' },
		data: insiders,
		columns,
		state: { sorting },
		enableSortingRemoval: false,
		onSortingChange: (updater) => startTransition(() => setSorting(updater))
	})

	return (
		<Panel padding="none">
			<PanelHeader className="flex-col items-start gap-1">
				<PanelTitle as="h3">Insiders</PanelTitle>
				{methodology ? <p className="text-sm text-secondary">{methodology}</p> : null}
			</PanelHeader>
			<div className="max-h-100 overflow-y-auto">
				<Table table={instance} stripedBg />
			</div>
		</Panel>
	)
}
