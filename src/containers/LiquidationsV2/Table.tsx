import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import type { BlockExplorersResponse } from '~/api/types'
import { BasicLink } from '~/components/Link'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { TableToolbar } from '~/ui/Toolbar'
import { formatCompactNumber, formatUsd } from '~/utils/numberFormat'
import type { LiquidationPosition, OverviewChainRow, OverviewProtocolRow, ProtocolChainRow } from './api.types'
import { LiquidationsExplorerProvider, LiquidationsOwnerLink } from './OwnerLink'
import { LiquidationsTableContent } from './TableTabs'

const protocolColumnHelper = createColumnHelper<SearchTableFeatures, OverviewProtocolRow>()
const overviewChainColumnHelper = createColumnHelper<SearchTableFeatures, OverviewChainRow>()
const protocolChainColumnHelper = createColumnHelper<SearchTableFeatures, ProtocolChainRow>()
const positionColumnHelper = createColumnHelper<SearchTableFeatures, LiquidationPosition>()

type LiquidationPositionSearchIndex = WeakMap<LiquidationPosition, string>

const normalizeSearchValue = (value: string) =>
	value
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()

export function createLiquidationPositionSearchIndex(rows: Array<LiquidationPosition>): LiquidationPositionSearchIndex {
	const index: LiquidationPositionSearchIndex = new WeakMap()
	for (const row of rows) {
		index.set(
			row,
			normalizeSearchValue(
				`${row.protocolName}\0${row.protocolSlug}\0${row.chainName}\0${row.chainSlug}\0${row.owner}\0${row.collateral}`
			)
		)
	}
	return index
}

export function filterLiquidationPositions(
	rows: Array<LiquidationPosition>,
	searchIndex: LiquidationPositionSearchIndex,
	searchValue: string
): Array<LiquidationPosition> {
	const searchTerm = normalizeSearchValue(searchValue.trim())
	if (!searchTerm) return rows

	const filtered: Array<LiquidationPosition> = []
	for (const row of rows) {
		if (searchIndex.get(row)!.includes(searchTerm)) filtered.push(row)
	}
	return filtered
}

const protocolColumns = protocolColumnHelper.columns([
	protocolColumnHelper.accessor('name', {
		id: 'name',
		header: 'Name',
		enableSorting: false,
		cell: ({ row, getValue }) => {
			const protocol = getValue()
			return (
				<span className="flex items-center gap-2">
					<TokenLogo name={protocol} kind="token" data-lgonly alt={`Logo of ${protocol}`} />
					<BasicLink href={`/liquidations/${row.original.slug}`} className="text-link hover:underline">
						{protocol}
					</BasicLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(220px,40vw)]'
		}
	}),
	protocolColumnHelper.accessor((row) => row.positionCount ?? undefined, {
		id: 'positionCount',
		header: 'Positions',
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	protocolColumnHelper.accessor((row) => row.chainCount ?? undefined, {
		id: 'chainCount',
		header: 'Chains',
		meta: {
			headerClassName: 'w-[90px]',
			align: 'end'
		}
	}),
	protocolColumnHelper.accessor((row) => row.collateralCount ?? undefined, {
		id: 'collateralCount',
		header: 'Tokens',
		meta: {
			headerClassName: 'w-[80px]',
			align: 'end'
		}
	}),
	protocolColumnHelper.accessor((row) => row.totalCollateralUsd ?? undefined, {
		id: 'totalCollateralUsd',
		header: 'Collateral USD',
		cell: ({ getValue }) =>
			formatUsd(getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[145px]',
			align: 'end'
		}
	})
])

const overviewChainColumns = overviewChainColumnHelper.columns([
	overviewChainColumnHelper.accessor('name', {
		id: 'name',
		header: 'Name',
		cell: ({ getValue }) => {
			const chain = getValue()
			return (
				<span className="flex items-center gap-2">
					<TokenLogo name={chain} kind="chain" data-lgonly alt={`Logo of ${chain}`} />
					<span>{chain}</span>
				</span>
			)
		},
		enableSorting: false,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]'
		}
	}),
	overviewChainColumnHelper.accessor((row) => row.positionCount ?? undefined, {
		id: 'positionCount',
		header: 'Positions',
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	overviewChainColumnHelper.accessor((row) => row.protocolCount ?? undefined, {
		id: 'protocolCount',
		header: 'Protocols',
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	overviewChainColumnHelper.accessor((row) => row.collateralCount ?? undefined, {
		id: 'collateralCount',
		header: 'Tokens',
		meta: {
			headerClassName: 'w-[80px]',
			align: 'end'
		}
	}),
	overviewChainColumnHelper.accessor((row) => row.totalCollateralUsd ?? undefined, {
		id: 'totalCollateralUsd',
		header: 'Collateral USD',
		cell: ({ getValue }) =>
			formatUsd(getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[145px]',
			align: 'end'
		}
	})
])

const protocolChainColumns = protocolChainColumnHelper.columns([
	protocolChainColumnHelper.accessor('name', {
		id: 'name',
		header: 'Name',
		enableSorting: false,
		cell: ({ row, getValue }) => {
			const chain = getValue()
			return (
				<span className="flex items-center gap-2">
					<TokenLogo name={chain} kind="chain" data-lgonly alt={`Logo of ${chain}`} />
					<BasicLink
						href={`/liquidations/${row.original.protocolSlug}/${row.original.slug}`}
						className="text-link hover:underline"
					>
						{chain}
					</BasicLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(180px,40vw)]'
		}
	}),
	protocolChainColumnHelper.accessor((row) => row.positionCount ?? undefined, {
		id: 'positionCount',
		header: 'Positions',
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	protocolChainColumnHelper.accessor((row) => row.collateralCount ?? undefined, {
		id: 'collateralCount',
		header: 'Tokens',
		meta: {
			headerClassName: 'w-[80px]',
			align: 'end'
		}
	}),
	protocolChainColumnHelper.accessor((row) => row.totalCollateralUsd ?? undefined, {
		id: 'totalCollateralUsd',
		header: 'Collateral USD',
		cell: ({ getValue }) =>
			formatUsd(getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[145px]',
			align: 'end'
		}
	})
])

const positionColumns = positionColumnHelper.columns([
	positionColumnHelper.accessor('protocolName', {
		id: 'protocolName',
		header: 'Protocol',
		enableSorting: false,
		cell: ({ row, getValue }) => {
			const protocol = getValue()
			return (
				<span className="flex items-center gap-2">
					<TokenLogo name={protocol} kind="token" data-lgonly alt={`Logo of ${protocol}`} />
					<BasicLink href={`/liquidations/${row.original.protocolSlug}`} className="text-link hover:underline">
						{protocol}
					</BasicLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(220px,40vw)]'
		}
	}),
	positionColumnHelper.accessor('chainName', {
		id: 'chainName',
		header: 'Chain',
		enableSorting: false,
		cell: ({ row, getValue }) => {
			const chain = getValue()
			return (
				<span className="flex items-center gap-2">
					<TokenLogo name={chain} kind="chain" data-lgonly alt={`Logo of ${chain}`} />
					<BasicLink
						href={`/liquidations/${row.original.protocolSlug}/${row.original.chainSlug}`}
						className="text-link hover:underline"
					>
						{chain}
					</BasicLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[140px]'
		}
	}),
	positionColumnHelper.accessor('owner', {
		id: 'owner',
		header: 'Owner',
		enableSorting: false,
		cell: ({ row }) => <LiquidationsOwnerLink position={row.original} />,
		meta: {
			headerClassName: 'w-[min(220px,40vw)]'
		}
	}),
	positionColumnHelper.accessor((row) => row.collateral ?? undefined, {
		id: 'collateral',
		header: 'Token',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[80px]',
			align: 'end'
		}
	}),
	positionColumnHelper.accessor((row) => row.collateralAmountUsd ?? undefined, {
		id: 'collateralAmountUsd',
		header: 'Collateral USD',
		cell: ({ getValue }) =>
			formatUsd(getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[145px]',
			align: 'end'
		}
	}),
	positionColumnHelper.accessor((row) => row.collateralAmount ?? undefined, {
		id: 'collateralAmount',
		header: 'Raw Amount',
		cell: ({ getValue }) =>
			formatCompactNumber(getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end'
		}
	}),
	positionColumnHelper.accessor((row) => row.liqPrice ?? undefined, {
		id: 'liqPrice',
		header: 'Liquidation Price',
		cell: ({ getValue }) =>
			formatUsd(getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end'
		}
	})
])

export function LiquidationsProtocolsTable({ rows }: { rows: Array<OverviewProtocolRow> }) {
	return (
		<SearchTableProvider
			options={{
				data: rows,
				columns: protocolColumns,
				initialState: { sorting: [{ id: 'totalCollateralUsd', desc: true }] }
			}}
		>
			<LiquidationsTableContent
				toolbar={
					<TableToolbar>
						<TableSearchInput columnId="name" placeholder="Search protocols..." />
						<TableCsvExport filename="liquidations-v2-100k-protocols" />
					</TableToolbar>
				}
			>
				<VirtualSearchTableView />
			</LiquidationsTableContent>
		</SearchTableProvider>
	)
}
export function LiquidationsOverviewChainsTable({ rows }: { rows: Array<OverviewChainRow> }) {
	return (
		<SearchTableProvider
			options={{
				data: rows,
				columns: overviewChainColumns,
				initialState: { sorting: [{ id: 'totalCollateralUsd', desc: true }] }
			}}
		>
			<LiquidationsTableContent
				toolbar={
					<TableToolbar>
						<TableSearchInput columnId="name" placeholder="Search chains..." />
						<TableCsvExport filename="liquidations-v2-100k-chains" />
					</TableToolbar>
				}
			>
				<VirtualSearchTableView />
			</LiquidationsTableContent>
		</SearchTableProvider>
	)
}
export function LiquidationsProtocolChainsTable({ rows }: { rows: Array<ProtocolChainRow> }) {
	return (
		<SearchTableProvider
			options={{
				data: rows,
				columns: protocolChainColumns,
				initialState: { sorting: [{ id: 'totalCollateralUsd', desc: true }] }
			}}
		>
			<LiquidationsTableContent
				toolbar={
					<TableToolbar>
						<TableSearchInput columnId="name" placeholder="Search chains..." />
						<TableCsvExport filename="liquidations-v2-100k-protocol-chains" />
					</TableToolbar>
				}
			>
				<VirtualSearchTableView />
			</LiquidationsTableContent>
		</SearchTableProvider>
	)
}
export function LiquidationsPositionsTable({
	rows,
	ownerBlockExplorers
}: {
	rows: Array<LiquidationPosition>
	ownerBlockExplorers: BlockExplorersResponse
}) {
	const [searchValue, setSearchValue] = React.useState('')
	const deferredSearchValue = React.useDeferredValue(searchValue)
	const searchIndex = React.useMemo(() => createLiquidationPositionSearchIndex(rows), [rows])
	const filteredRows = React.useMemo(
		() => filterLiquidationPositions(rows, searchIndex, deferredSearchValue),
		[rows, searchIndex, deferredSearchValue]
	)

	return (
		<LiquidationsExplorerProvider blockExplorers={ownerBlockExplorers}>
			<SearchTableProvider
				options={{
					data: filteredRows,
					columns: positionColumns,
					initialState: { sorting: [{ id: 'collateralAmountUsd', desc: true }] }
				}}
			>
				<LiquidationsTableContent
					toolbar={
						<TableToolbar>
							<label className={searchFieldInlineWrapperStyles}>
								<span className="sr-only">Search positions</span>
								<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
								<input
									onInput={(e) => setSearchValue(e.currentTarget.value)}
									placeholder="Search positions by protocol, chain, owner, or collateral"
									className={searchFieldInputStyles}
								/>
							</label>
							<TableCsvExport filename="liquidations-v2-100k-positions" />
						</TableToolbar>
					}
				>
					<VirtualSearchTableView />
				</LiquidationsTableContent>
			</SearchTableProvider>
		</LiquidationsExplorerProvider>
	)
}
