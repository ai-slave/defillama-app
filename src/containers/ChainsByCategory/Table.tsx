import {
	type ColumnFiltersState,
	createColumnHelper,
	type ExpandedState,
	type SortingState,
	useTable
} from '@tanstack/react-table'
import * as React from 'react'
import { Bookmark } from '~/components/Bookmark'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'
import { TVLRange } from '~/components/Filters/TVLRange'
import { searchTableFeatures } from '~/components/Table/features/search'
import { getColumnSelectState, getColumnVisibilityForSelection } from '~/components/Table/search/columnSelect'
import type { ColumnOrdersByBreakpoint } from '~/components/Table/utils'
import { prepareTableCsv, useSortColumnOrders, useTableSearch } from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { TokenLogo } from '~/components/TokenLogo'
import { CHAINS_CATEGORY_GROUP_SETTINGS, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { definitions } from '~/public/definitions'
import { Button } from '~/ui/Button'
import { Change } from '~/ui/Change'
import { Icon } from '~/ui/Icon'
import { Panel } from '~/ui/Panel'
import { SearchField } from '~/ui/SearchField'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { TextLink } from '~/ui/TextLink'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { formatCompactNumber, formatRatio, formatUsd, roundNumber } from '~/utils/numberFormat'
import type { IFormattedDataWithExtraTvl } from './types'

/** Tooltip rows in display order; the v2-only sections stay hidden until the producer reports them. */
const CHAIN_ASSET_TOOLTIP_ROWS = [
	{ key: 'native', label: 'Native' },
	{ key: 'canonical', label: 'Canonical' },
	{ key: 'ownTokens', label: 'Own Tokens' },
	{ key: 'thirdParty', label: 'Third Party' },
	{ key: 'stablecoins', label: 'Stablecoins' },
	{ key: 'rwa', label: 'RWAs' },
	{ key: 'lst', label: 'Liquid Staking' }
] as const

function hasChainAssetTableValue(value: number | undefined): value is number {
	return value != null
}

const optionsKey = 'chains-overview-table-columns'

export function ChainsByCategoryTable({
	data,
	useStickyHeader = true,
	borderless = false,
	showByGroup,
	tvlQuickPicks
}: {
	data: Array<IFormattedDataWithExtraTvl>
	useStickyHeader?: boolean
	borderless?: boolean
	showByGroup: boolean
	tvlQuickPicks: ReadonlyArray<number>
}) {
	const rawColumnsInStorage = useStorageItem(optionsKey, '{}')
	const columnsInStorage = React.useDeferredValue(rawColumnsInStorage)
	// Columns missing from the stored map are visible, so columns added later show up for returning readers.
	const columnVisibility = React.useMemo(() => {
		try {
			return JSON.parse(columnsInStorage) as Record<string, boolean>
		} catch {
			// A corrupt stored value falls back to the defaults.
			return {}
		}
	}, [columnsInStorage])

	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'tvl', desc: true }])
	const [expanded, setExpanded] = React.useState<ExpandedState>(showByGroup ? true : {})

	const instance = useTable({
		features: searchTableFeatures,
		data,
		columns,
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
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater))
	})

	const [projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })
	useSortColumnOrders({
		instance,
		columnOrders: chainsTableColumnOrders
	})

	const leafColumns = instance.getAllLeafColumns()
	const columnSelect = getColumnSelectState(leafColumns, columnVisibility)

	const [groupTvls, updater] = useLocalStorageSettingsManager('tvl_chains')

	const selectedAggregateTypes = React.useMemo(() => {
		return CHAINS_CATEGORY_GROUP_SETTINGS.flatMap((key) => (groupTvls[key.key] ? [key.key] : []))
	}, [groupTvls])

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

	const tableContent = (
		<>
			<TableToolbar>
				<SearchField
					label="Search chains"
					value={projectName}
					onChange={setProjectName}
					placeholder="Search…"
					width="standalone"
				/>

				{showByGroup ? (
					<SelectWithCombobox
						allValues={CHAINS_CATEGORY_GROUP_SETTINGS}
						selectedValues={selectedAggregateTypes}
						setSelectedValues={setAggrOptions}
						nestedMenu={false}
						label="Group Chains"
						labelType="smol"
						variant="filter"
						size="md"
					/>
				) : null}
				<SelectWithCombobox
					allValues={columnSelect.options}
					selectedValues={columnSelect.selected}
					setSelectedValues={(selected: Array<string>) =>
						setStorageItem(optionsKey, JSON.stringify(getColumnVisibilityForSelection(leafColumns, selected)))
					}
					nestedMenu={false}
					label="Columns"
					labelType="smol"
					variant="filter"
					size="md"
				/>
				<TVLRange size="md" quickPicks={tvlQuickPicks} />
				<CSVDownloadButton
					prepareCsv={() => prepareTableCsv({ instance, filename: 'defillama-chains' })}
					smol
					size="md"
				/>
			</TableToolbar>
			<VirtualTable table={instance} useStickyHeader={useStickyHeader} />
		</>
	)

	return borderless ? <div className="isolate">{tableContent}</div> : <Panel className="isolate">{tableContent}</Panel>
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

const columnHelper = createColumnHelper<typeof searchTableFeatures, IFormattedDataWithExtraTvl>()

const columns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Name',
		enableHiding: false,
		enableSorting: true,
		cell: ({ getValue, row }) => {
			const value = getValue()
			return (
				<span
					className="relative flex items-center gap-2"
					style={{ paddingLeft: row.depth ? row.depth * 48 : row.depth === 0 ? 24 : 0 }}
				>
					{row.subRows?.length > 0 ? (
						<Button
							size="sm"
							variant="ghost"
							square
							aria-expanded={row.getIsExpanded()}
							type="button"
							className="absolute -left-1.5"
							{...{
								onClick: row.getToggleExpandedHandler()
							}}
						>
							{row.getIsExpanded() ? (
								<>
									<Icon name="chevron-down" className="size-4 text-tertiary" />
									<span className="sr-only">View child protocols</span>
								</>
							) : (
								<>
									<Icon name="chevron-right" className="size-4 text-tertiary" />
									<span className="sr-only">Hide child protocols</span>
								</>
							)}
						</Button>
					) : (
						<Bookmark size="sm" readableName={value} isChain className="absolute -left-1.5" />
					)}
					<span className="vf-row-index shrink-0" aria-hidden="true" />

					<TokenLogo name={value} kind="chain" alt={`Logo of ${value}`} />
					<TextLink href={`/chain/${slug(value)}`} truncate>
						{value}
					</TextLink>
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
		cell: (info) => <Change value={info.getValue()} />,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: 'Change in TVL in the last 24 hours'
		}
	}),
	columnHelper.accessor((row) => row.change_7d ?? undefined, {
		id: 'change_7d',
		header: '7d TVL Change',
		cell: (info) => <Change value={info.getValue()} />,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: 'Change in TVL in the last 7 days'
		}
	}),
	columnHelper.accessor((row) => row.change_1m ?? undefined, {
		id: 'change_1m',
		header: '30d TVL Change',
		cell: (info) => <Change value={info.getValue()} />,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: 'Change in TVL in the last 30 days'
		}
	}),
	columnHelper.accessor(
		(row) => {
			const total = row.chainAssets?.total.total
			return hasChainAssetTableValue(total) ? roundNumber(total, 2) : undefined
		},
		{
			id: 'chainAssets',
			header: 'Bridged TVL',
			cell: ({ row }) => {
				const chainAssets = row.original.chainAssets
				if (!chainAssets) return null

				const chainAssetsBreakdown = (
					<div className="flex w-52 flex-col gap-1">
						{CHAIN_ASSET_TOOLTIP_ROWS.map(({ key, label }) => {
							const total = chainAssets[key]?.total
							return hasChainAssetTableValue(total) ? (
								<div key={key} className="flex items-center justify-between gap-1">
									<span>{label}:</span>
									<span>
										{formatUsd(total, {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})}
									</span>
								</div>
							) : null
						})}
					</div>
				)

				return (
					<Tooltip content={chainAssetsBreakdown} className="justify-end">
						{formatUsd(chainAssets.total.total, {
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
		header: 'Stablecoins Market Cap',
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
	})
])
