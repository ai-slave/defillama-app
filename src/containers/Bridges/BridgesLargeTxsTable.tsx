import {
	columnOrderingFeature,
	type ColumnOrderState,
	columnSizingFeature,
	createColumnHelper,
	createSortedRowModel,
	type SortingState,
	tableFeatures,
	useTable
} from '@tanstack/react-table'
import type { Ref } from 'react'
import * as React from 'react'
import { useBlockExplorers } from '~/api/client'
import { BasicLink } from '~/components/Link'
import { columnVisibilityFeature } from '~/components/Table/features/display'
import { sortingFeatures } from '~/components/Table/features/sorting'
import type { ColumnOrdersByBreakpoint } from '~/components/Table/utils'
import { prepareTableCsv, useSortColumnOrders } from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { Icon } from '~/ui/Icon'
import { slug } from '~/utils'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { formatDateTime } from '~/utils/dateFormat'
import { formatUsd } from '~/utils/numberFormat'

const tableFeaturesConfig = tableFeatures({
	...sortingFeatures,
	columnVisibilityFeature,
	columnSizingFeature,
	columnOrderingFeature,
	sortedRowModel: createSortedRowModel()
})

type LargeTxsData = {
	date: number
	txHash: string
	bridge: string
	isDeposit: boolean
	symbol: string
	usdValue: string | number
}

export type BridgesLargeTxsTableHandle = {
	prepareCsv: () => {
		filename: string
		rows: Array<Array<string | number | boolean | null | undefined>>
	}
}

type BridgesLargeTxsTableProps = {
	data: Array<LargeTxsData>
	csvFileName?: string
}

const columnHelper = createColumnHelper<typeof tableFeaturesConfig, LargeTxsData>()

const largeTxsColumnOrders: ColumnOrdersByBreakpoint = {
	0: ['date', 'symbol', 'usdValue', 'isDeposit', 'bridge', 'txHash'],
	1024: ['date', 'bridge', 'isDeposit', 'symbol', 'usdValue', 'txHash']
}
export function BridgesLargeTxsTable({
	data,
	csvFileName = 'bridge-transactions',
	ref
}: BridgesLargeTxsTableProps & { ref?: Ref<BridgesLargeTxsTableHandle> }) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'date', desc: true }])
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])
	const { data: blockExplorersData } = useBlockExplorers()

	const columns = React.useMemo(
		() =>
			columnHelper.columns([
				columnHelper.accessor((row) => row.date ?? undefined, {
					id: 'date',
					header: 'Timestamp',
					cell: (info) => (
						<span className="whitespace-nowrap">
							{formatDateTime(info.getValue(), { input: 'seconds', timeZone: 'UTC' }) ?? '–'}
						</span>
					),
					meta: {
						headerClassName: 'w-[220px]'
					}
				}),
				columnHelper.accessor('bridge', {
					header: 'Bridge',
					cell: ({ getValue }) => {
						const value = getValue()
						const linkValue = slug(value)
						return (
							<BasicLink href={`/bridge/${linkValue}`} className="truncate label-md text-link hover:underline">
								{value}
							</BasicLink>
						)
					},
					meta: {
						headerClassName: 'w-[140px] lg:w-[160px]'
					}
				}),
				columnHelper.accessor('isDeposit', {
					header: 'Deposit/Withdrawal',
					cell: ({ getValue }) => {
						const value = getValue()
						return (
							<span className={`${value ? 'text-data-down' : 'text-data-up'}`}>{value ? 'Withdrawal' : 'Deposit'}</span>
						)
					},
					meta: {
						headerClassName: 'w-[140px]',
						align: 'end'
					}
				}),
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
							return <span>{symbol}</span>
						}

						return (
							<a
								href={explorer.url}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-end"
							>
								<span>{symbol}</span>
								<Icon name="external-link" className="size-3.5" />
							</a>
						)
					},
					meta: {
						headerClassName: 'w-[100px] min-[480px]:w-[120px]',
						align: 'end'
					}
				}),
				columnHelper.accessor((row) => row.usdValue ?? undefined, {
					id: 'usdValue',
					header: 'Value',
					cell: (info) =>
						formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
					meta: {
						headerClassName: 'w-[120px]',
						align: 'end'
					}
				}),
				columnHelper.accessor('txHash', {
					header: 'Explorer Link',
					cell: ({ getValue }) => {
						const value = getValue()
						if (!value) return 'Not found'

						const explorer = getBlockExplorerNew({
							apiResponse: blockExplorersData ?? [],
							address: value,
							urlType: 'tx'
						})

						if (!explorer) {
							return null
						}

						return (
							<a
								href={explorer.url}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-end gap-2"
							>
								<span>View Transaction</span>
								<Icon name="external-link" className="size-3.5" />
							</a>
						)
					},
					meta: {
						headerClassName: 'w-[160px]',
						align: 'end'
					}
				})
			]),
		[blockExplorersData]
	)

	const instance = useTable({
		features: tableFeaturesConfig,
		data,
		columns,
		state: {
			sorting,
			columnOrder
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		onColumnOrderChange: (updater) => React.startTransition(() => setColumnOrder(updater))
	})

	useSortColumnOrders({
		instance,
		columnOrders: largeTxsColumnOrders
	})

	React.useImperativeHandle(
		ref,
		() => ({
			prepareCsv: () => prepareTableCsv({ instance, filename: csvFileName })
		}),
		[csvFileName, instance]
	)

	return <VirtualTable table={instance} />
}
