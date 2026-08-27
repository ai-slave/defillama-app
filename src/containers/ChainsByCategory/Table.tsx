import {
	type ColumnFiltersState,
	createColumnHelper,
	type ExpandedState,
	getCoreRowModel,
	getExpandedRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import * as React from 'react'
import { Bookmark } from '~/components/Bookmark'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'
import { TVLRange } from '~/components/Filters/TVLRange'
import { BasicLink } from '~/components/Link'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { VirtualTable } from '~/components/Table/Table'
import { prepareTableCsv, useSortColumnOrders, useTableSearch } from '~/components/Table/utils'
import type { ColumnOrdersByBreakpoint } from '~/components/Table/utils'
import { TokenLogo } from '~/components/TokenLogo'
import type { ChainAssetTotals } from '~/containers/BridgedTVL/api.types'
import { CHAINS_CATEGORY_GROUP_SETTINGS, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { definitions } from '~/public/definitions'
import { Icon } from '~/ui/Icon'
import { searchFieldWrapperStyles, searchFieldIconStyles, searchFieldInputStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { PercentChange } from '~/ui/PercentChange'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { formatRatio, formatUsd, formatCompactNumber, roundNumber } from '~/utils/numberFormat'
import type { IFormattedDataWithExtraTvl } from './types'

export function getChainAssetTableValues(chainAssets: ChainAssetTotals | null | undefined) {
	if (!chainAssets) return null
	return {
		total: chainAssets.total.total,
		canonical: chainAssets.canonical.total,
		native: chainAssets.native?.total,
		ownTokens: chainAssets.ownTokens?.total,
		thirdParty: chainAssets.thirdParty.total
	}
}

export function hasChainAssetTableValue(value: number | undefined): value is number {
	return value != null
}

const optionsKey = 'chains-overview-table-columns'

const setColumnOptions = (newOptions: string[]) => {
	const ops = Object.fromEntries(columnOptions.map((col) => [col.key, newOptions.includes(col.key)]))
	setStorageItem(optionsKey, JSON.stringify(ops))
}

export function ChainsByCategoryTable({
	data,
	useStickyHeader = true,
	borderless = false,
	showByGroup
}: {
	data: Array<IFormattedDataWithExtraTvl>
	useStickyHeader?: boolean
	borderless?: boolean
	showByGroup: boolean
}) {
	const rawColumnsInStorage = useStorageItem(optionsKey, defaultColumns)
	const columnsInStorage = React.useDeferredValue(rawColumnsInStorage)
	const { columnVisibility, selectedColumns } = React.useMemo(() => {
		const defaultColumnVisibility = Object.fromEntries(columnOptions.map((column) => [column.key, true] as const))
		let parsedColumnVisibility: Record<string, boolean> = {}
		try {
			parsedColumnVisibility = JSON.parse(columnsInStorage) as Record<string, boolean>
		} catch {}

		const columnVisibility = { ...defaultColumnVisibility, ...parsedColumnVisibility }
		const selectedColumns = columnOptions.flatMap((column) => (columnVisibility[column.key] ? [column.key] : []))

		return { columnVisibility, selectedColumns }
	}, [columnsInStorage])

	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'tvl', desc: true }])
	const [expanded, setExpanded] = React.useState<ExpandedState>(showByGroup ? true : {})

	const instance = useReactTable({
		data,
		columns: columns,
		state: {
			sorting,
			expanded,
			columnFilters,
			columnVisibility
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onExpandedChange: (updater) => React.startTransition(() => setExpanded(updater)),
		getSubRows: (row: IFormattedDataWithExtraTvl) => row.subRows,
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater)),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		getFilteredRowModel: getFilteredRowModel()
	})

	const [_projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })
	useSortColumnOrders({
		instance,
		columnOrders: chainsTableColumnOrders
	})

	const [groupTvls, updater] = useLocalStorageSettingsManager('tvl_chains')

	const setAggrOptions: React.Dispatch<React.SetStateAction<Array<string>>> = (selectedKeys) => {
		const nextSelectedKeys = typeof selectedKeys === 'function' ? selectedKeys(selectedAggregateTypes) : selectedKeys
		const selectedKeysSet = new Set(nextSelectedKeys)
		// Keep expansion synchronous so persisted setting notifications cannot restart it.
		setExpanded(true)
		for (const item of CHAINS_CATEGORY_GROUP_SETTINGS) {
			const shouldEnable = selectedKeysSet.has(item.key)
			if (groupTvls[item.key] !== shouldEnable) {
				updater(item.key)
			}
		}
	}

	const selectedAggregateTypes = React.useMemo(() => {
		return CHAINS_CATEGORY_GROUP_SETTINGS.flatMap((key) => (groupTvls[key.key] ? [key.key] : []))
	}, [groupTvls])

	const tableContent = (
		<>
			<TableToolbar className="justify-end">
				<label className={searchFieldWrapperStyles}>
					<span className="sr-only">Search chains</span>
					<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
					<input
						onInput={(e) => setProjectName(e.currentTarget.value)}
						placeholder="Search..."
						className={searchFieldInputStyles}
					/>
				</label>

				<div className="flex items-center gap-1.5 max-sm:w-full max-sm:flex-col">
					<div className="flex w-full items-center gap-1.5 sm:w-auto">
						{showByGroup ? (
							<SelectWithCombobox
								allValues={CHAINS_CATEGORY_GROUP_SETTINGS}
								selectedValues={selectedAggregateTypes}
								setSelectedValues={setAggrOptions}
								nestedMenu={false}
								label={'Group Chains'}
								labelType="smol"
								variant="filter-responsive"
								size="md"
							/>
						) : null}
						<SelectWithCombobox
							allValues={columnOptions}
							selectedValues={selectedColumns}
							setSelectedValues={setColumnOptions}
							nestedMenu={false}
							label={'Columns'}
							labelType="smol"
							variant="filter-responsive"
							size="md"
						/>
					</div>

					<TVLRange size="md" />
					<CSVDownloadButton
						prepareCsv={() => prepareTableCsv({ instance, filename: 'defillama-chains' })}
						smol
						size="md"
					/>
				</div>
			</TableToolbar>
			<VirtualTable instance={instance} useStickyHeader={useStickyHeader} />
		</>
	)

	return borderless ? (
		<div className="isolate">{tableContent}</div>
	) : (
		<Panel padding="none" className="isolate">
			{tableContent}
		</Panel>
	)
}

const chainsTableColumnOrders: ColumnOrdersByBreakpoint = {
	0: [
		'name',
		'tvl',
		'chainAssets',
		'change_7d',
		'protocols',
		'change_1d',
		'change_1m',
		'stablesMcap',
		'dexVolume24h',
		'fees24h',
		'revenue24h',
		'activeUsers24h',
		'mcaptvl'
	],
	400: [
		'name',
		'change_7d',
		'tvl',
		'chainAssets',
		'protocols',
		'change_1d',
		'change_1m',
		'stablesMcap',
		'dexVolume24h',
		'fees24h',
		'revenue24h',
		'activeUsers24h',
		'mcaptvl'
	],
	600: [
		'name',
		'protocols',
		'tvl',
		'change_7d',
		'chainAssets',
		'change_1d',
		'change_1m',
		'stablesMcap',
		'dexVolume24h',
		'fees24h',
		'revenue24h',
		'activeUsers24h',
		'mcaptvl'
	],
	900: [
		'name',
		'protocols',
		'tvl',
		'change_1d',
		'change_7d',
		'change_1m',
		'chainAssets',
		'stablesMcap',
		'dexVolume24h',
		'fees24h',
		'revenue24h',
		'activeUsers24h',
		'mcaptvl'
	]
}

const columnHelper = createColumnHelper<IFormattedDataWithExtraTvl>()

const columns = [
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: true,
		cell: ({ getValue, row }) => {
			const value = getValue()
			return (
				<span
					className="relative flex items-center gap-2"
					style={{ paddingLeft: row.depth ? row.depth * 48 : row.depth === 0 ? 24 : 0 }}
				>
					{row.subRows?.length > 0 ? (
						<button
							className="absolute -left-0.5"
							{...{
								onClick: row.getToggleExpandedHandler()
							}}
						>
							{row.getIsExpanded() ? (
								<>
									<Icon name="chevron-down" height={16} width={16} className="text-tertiary" />
									<span className="sr-only">View child protocols</span>
								</>
							) : (
								<>
									<Icon name="chevron-right" height={16} width={16} className="text-tertiary" />
									<span className="sr-only">Hide child protocols</span>
								</>
							)}
						</button>
					) : (
						<Bookmark readableName={value} isChain data-bookmark className="absolute -left-0.5" />
					)}
					<span className="vf-row-index shrink-0" aria-hidden="true" />

					<TokenLogo name={value} kind="chain" alt={`Logo of ${value}`} />
					<BasicLink href={`/chain/${slug(value)}`} className="truncate text-sm font-medium text-link hover:underline">
						{value}
					</BasicLink>
					{row.original.deprecated ? <DeprecatedEntityMarker content="Deprecated chain" /> : null}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(200px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.protocols ?? undefined, {
		id: 'protocols',
		header: 'Protocols',
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.tvl ?? undefined, {
		id: 'tvl',
		header: 'DeFi TVL',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end',
			headerHelperText: 'Sum of value of all coins held in smart contracts of all the protocols on the chain'
		}
	}),
	columnHelper.accessor((row) => row.change_1d ?? undefined, {
		id: 'change_1d',
		header: '1d TVL Change',
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: 'Change in TVL in the last 24 hours'
		}
	}),
	columnHelper.accessor((row) => row.change_7d ?? undefined, {
		id: 'change_7d',
		header: '7d TVL Change',
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: 'Change in TVL in the last 7 days'
		}
	}),
	columnHelper.accessor((row) => row.change_1m ?? undefined, {
		id: 'change_1m',
		header: '1m TVL Change',
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: 'Change in TVL in the last 30 days'
		}
	}),
	columnHelper.accessor(
		(row) => {
			const total = getChainAssetTableValues(row.chainAssets)?.total
			return hasChainAssetTableValue(total) ? roundNumber(total, 2) : undefined
		},
		{
			id: 'chainAssets',
			header: 'Bridged TVL',
			cell: ({ row }) => {
				const chainAssets = getChainAssetTableValues(row.original.chainAssets)
				if (!chainAssets) return null

				const chainAssetsBreakdown = (
					<div className="flex w-52 flex-col gap-1">
						{hasChainAssetTableValue(chainAssets.native) ? (
							<div className="flex items-center justify-between gap-1">
								<span>Native:</span>
								<span>
									{formatUsd(chainAssets.native, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								</span>
							</div>
						) : null}
						{hasChainAssetTableValue(chainAssets.canonical) ? (
							<div className="flex items-center justify-between gap-1">
								<span>Canonical:</span>
								<span>
									{formatUsd(chainAssets.canonical, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								</span>
							</div>
						) : null}
						{hasChainAssetTableValue(chainAssets.ownTokens) ? (
							<div className="flex items-center justify-between gap-1">
								<span>Own Tokens:</span>
								<span>
									{formatUsd(chainAssets.ownTokens, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								</span>
							</div>
						) : null}
						{hasChainAssetTableValue(chainAssets.thirdParty) ? (
							<div className="flex items-center justify-between gap-1">
								<span>Third Party:</span>
								<span>
									{formatUsd(chainAssets.thirdParty, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								</span>
							</div>
						) : null}
					</div>
				)

				return (
					<Tooltip content={chainAssetsBreakdown} className="justify-end">
						{formatUsd(chainAssets.total, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
					</Tooltip>
				)
			},
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end',
				headerHelperText: 'Value of all tokens held on the chain'
			}
		}
	),
	columnHelper.accessor((row) => row.stablesMcap ?? undefined, {
		id: 'stablesMcap',
		header: 'Stables MCap',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[128px]',
			align: 'end',
			headerHelperText: 'Sum of market cap of all stablecoins on the chain'
		}
	}),
	columnHelper.accessor((row) => row.dexVolume24h ?? undefined, {
		id: 'dexVolume24h',
		header: '24h DEXs Volume',
		enableSorting: true,
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[152px]',
			align: 'end',
			headerHelperText: 'Sum of 24h volume on all DEXs on the chain. Updated daily at 00:00UTC'
		}
	}),
	columnHelper.accessor((row) => row.fees24h ?? undefined, {
		id: 'fees24h',
		header: `24h Chain Fees`,
		enableSorting: true,
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: definitions.fees.chain['24h']
		}
	}),
	columnHelper.accessor((row) => row.appRevenue24h ?? undefined, {
		id: 'appRevenue24h',
		header: `24h App Revenue`,
		enableSorting: true,
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: definitions.appRevenue.chain['24h']
		}
	}),
	columnHelper.accessor((row) => row.activeUsers24h ?? undefined, {
		id: 'activeUsers24h',
		header: '24h Active Addresses',
		cell: (info) => {
			const value = info.getValue()
			return value != null && value > 0
				? formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null
		},
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: 'Active addresses in the last 24h'
		}
	}),
	columnHelper.accessor((row) => row.mcaptvl ?? undefined, {
		id: 'mcaptvl',
		header: 'Mcap / DeFi TVL',
		cell: (info) => formatRatio(info.getValue()),
		meta: {
			headerClassName: 'w-[148px]',
			align: 'end',
			headerHelperText: 'Market cap / DeFi TVL ratio'
		}
	}),
	columnHelper.accessor((row) => row.nftVolume24h ?? undefined, {
		id: 'nftVolume24h',
		header: '24h NFT Volume',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[148px]',
			align: 'end',
			headerHelperText: 'Sum of 24h volume on all NFTs on the chain. Updated daily at 00:00UTC'
		}
	})
]

const getColumnKey = (column: (typeof columns)[number]) =>
	column.id ?? ('accessorKey' in column ? column.accessorKey : '')

const columnOptions = columns
	.map((column) => ({
		name: typeof column.header === 'string' ? column.header : getColumnKey(column),
		key: getColumnKey(column)
	}))
	.filter((c) => c.key !== '')

const defaultColumns = JSON.stringify(Object.fromEntries(columnOptions.map((c) => [c.key, true])))
