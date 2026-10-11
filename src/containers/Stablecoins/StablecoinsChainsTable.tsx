import {
	type ColumnFiltersState,
	createColumnHelper,
	type ExpandedState,
	type SortingState,
	useTable
} from '@tanstack/react-table'
import * as React from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'
import { BasicLink } from '~/components/Link'
import { expandedFilteredTableFeatures } from '~/components/Table/features/expandedFiltering'
import { prepareTableCsv, useTableSearch } from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { TokenLogo } from '~/components/TokenLogo'
import type { useGroupChainsPegged } from '~/containers/Stablecoins/hooks'
import { CHAINS_CATEGORY_GROUP_SETTINGS, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { Change } from '~/ui/Change'
import { Icon } from '~/ui/Icon'
import { Panel } from '~/ui/Panel'
import { SearchField } from '~/ui/SearchField'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { TableToolbar } from '~/ui/Toolbar'
import { slug } from '~/utils'
import { formatPercent, formatUsd } from '~/utils/numberFormat'

type StablecoinsByChainRow = ReturnType<typeof useGroupChainsPegged>[number]
type StablecoinsChainsTableMeta = { deprecatedChains: Record<string, true> }
type DominanceCell = NonNullable<StablecoinsByChainRow['dominance']>
const columnHelper = createColumnHelper<typeof expandedFilteredTableFeatures, StablecoinsByChainRow>()

const stablecoinsByChainColumns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row, table }) => {
			const value = getValue()
			const isSubRow = value.startsWith('Bridged from')
			const deprecatedChains = (table.options.meta as StablecoinsChainsTableMeta | undefined)?.deprecatedChains ?? {}

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
									<span className="sr-only">Hide child protocols</span>
								</>
							) : (
								<>
									<Icon name="chevron-right" className="size-4 text-tertiary" />
									<span className="sr-only">View child protocols</span>
								</>
							)}
						</Button>
					) : null}

					{isSubRow ? (
						<>
							<span className="vf-row-index shrink-0" aria-hidden="true" />
							<span>{value}</span>
						</>
					) : (
						<>
							<span className="vf-row-index shrink-0" aria-hidden="true" />
							<TokenLogo name={value} kind="chain" data-lgonly alt={`Logo of ${value}`} />
							<BasicLink href={`/stablecoins/${slug(value)}`} className="truncate label-md text-link hover:underline">
								{value}
							</BasicLink>
							{deprecatedChains[value] ? <DeprecatedEntityMarker content="Deprecated chain" /> : null}
						</>
					)}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(200px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.change_7d ?? undefined, {
		id: 'change_7d',
		header: '7d Change',
		cell: (info) => <Change value={info.getValue()} />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.mcap ?? undefined, {
		id: 'mcap',
		header: 'Stablecoins market cap',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[132px]',
			align: 'end'
		}
	}),
	columnHelper.accessor(
		(row) => {
			const value = row.dominance
			if (!value) return ''
			return `${value.name}${value.value != null ? `: ${formatPercent(value.value, { input: 'percent' })}` : ''}`
		},
		{
			id: 'dominance',
			header: 'Dominant Stablecoin',
			enableSorting: false,
			cell: ({ row }) => {
				const value = row.original.dominance as DominanceCell | null

				if (!value) {
					return null
				}

				return (
					<div className="flex w-full items-center justify-end gap-1">
						<span>{`${value.name}${value.value ? ':' : ''}`}</span>
						<span>{formatPercent(value.value, { input: 'percent' })}</span>
					</div>
				)
			},
			meta: {
				headerClassName: 'w-[170px]',
				align: 'end'
			}
		}
	),
	columnHelper.accessor((row) => row.minted ?? undefined, {
		id: 'minted',
		header: 'Total Mcap Issued On',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.bridgedTo ?? undefined, {
		id: 'bridgedTo',
		header: 'Total Mcap Bridged To',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[min(185px,40vw)]',
			align: 'end'
		}
	})
])

export function StablecoinsChainsTable({
	data,
	deprecatedChains
}: {
	data: Array<StablecoinsByChainRow>
	deprecatedChains: Record<string, true>
}) {
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'mcap', desc: true }])
	const [expanded, setExpanded] = React.useState<ExpandedState>({})

	const instance = useTable({
		features: expandedFilteredTableFeatures,
		data,
		columns: stablecoinsByChainColumns,
		state: {
			sorting,
			expanded,
			columnFilters
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		meta: {
			deprecatedChains
		},
		enableSortingRemoval: false,
		onExpandedChange: (updater) => React.startTransition(() => setExpanded(updater)),
		getSubRows: (row: StablecoinsByChainRow) => row.subRows,
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater))
	})

	const [projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })
	const [groupTvls, updater] = useLocalStorageSettingsManager('tvl_chains')

	const selectedAggregateTypes = React.useMemo(() => {
		return CHAINS_CATEGORY_GROUP_SETTINGS.flatMap((key) => (groupTvls[key.key] ? [key.key] : []))
	}, [groupTvls])

	const setAggrOptions: React.Dispatch<React.SetStateAction<Array<string>>> = (action) => {
		const selectedKeys = typeof action === 'function' ? action(selectedAggregateTypes) : action
		const selectedSet = new Set(selectedKeys)
		for (const item of CHAINS_CATEGORY_GROUP_SETTINGS) {
			const shouldEnable = selectedSet.has(item.key)
			if (groupTvls[item.key] !== shouldEnable) {
				updater(item.key)
			}
		}
	}

	return (
		<Panel>
			<TableToolbar>
				<SearchField
					label="Search chains"
					value={projectName}
					onChange={setProjectName}
					placeholder="Search…"
					width="standalone"
				/>
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
				<CSVDownloadButton
					prepareCsv={() => prepareTableCsv({ instance, filename: 'stablecoins-chains' })}
					smol
					size="md"
				/>
			</TableToolbar>
			<VirtualTable table={instance} />
		</Panel>
	)
}
