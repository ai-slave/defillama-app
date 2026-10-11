// Standalone liquidations pages reset search and sorting when the view tab changes: they pass `resetTableOnChange`,
// which keys the tab panel in TableTabs.tsx. Token pages keep table state across views instead.
import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import type { BlockExplorersResponse } from '~/api/types'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { TokenLogo } from '~/components/TokenLogo'
import { SearchField } from '~/ui/SearchField'
import { TextLink } from '~/ui/TextLink'
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
					<TextLink href={`/liquidations/${row.original.slug}`}>{protocol}</TextLink>
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
					<TextLink href={`/liquidations/${row.original.protocolSlug}/${row.original.slug}`}>{chain}</TextLink>
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
					<TextLink href={`/liquidations/${row.original.protocolSlug}`}>{protocol}</TextLink>
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
					<TextLink href={`/liquidations/${row.original.protocolSlug}/${row.original.chainSlug}`}>{chain}</TextLink>
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
						<TableSearchInput columnId="name" placeholder="Search protocols…" />
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
						<TableSearchInput columnId="name" placeholder="Search chains…" />
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
						<TableSearchInput columnId="name" placeholder="Search chains…" />
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
							<SearchField
								label="Search positions"
								value={searchValue}
								onChange={setSearchValue}
								placeholder="Search positions by protocol, chain, owner, or collateral"
								width="inline"
							/>
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
