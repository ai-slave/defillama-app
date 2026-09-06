import { createColumnHelper } from '@tanstack/react-table'
import * as React from 'react'
import type { BlockExplorersResponse } from '~/api/types'
import { BasicLink } from '~/components/Link'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { formatUsd, formatCompactNumber } from '~/utils/numberFormat'
import type { LiquidationPosition, OverviewChainRow, OverviewProtocolRow, ProtocolChainRow } from './api.types'
import { LiquidationsExplorerProvider, LiquidationsOwnerLink } from './OwnerLink'

interface LiquidationsTableProps {
	embedded?: boolean
	leadingControls?: React.ReactNode | null
}

const protocolColumnHelper = createColumnHelper<OverviewProtocolRow>()
const overviewChainColumnHelper = createColumnHelper<OverviewChainRow>()
const protocolChainColumnHelper = createColumnHelper<ProtocolChainRow>()
const positionColumnHelper = createColumnHelper<LiquidationPosition>()

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

const protocolColumns = [
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
]

const overviewChainColumns = [
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
]

const protocolChainColumns = [
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
]

const positionColumns = [
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
]

export function LiquidationsProtocolsTable({
	rows,
	embedded = false,
	leadingControls = null
}: { rows: Array<OverviewProtocolRow> } & LiquidationsTableProps) {
	return (
		<TableWithSearch
			data={rows}
			columns={protocolColumns}
			header={embedded ? null : 'Protocols'}
			leadingControls={leadingControls}
			columnToSearch="name"
			placeholder="Search protocols..."
			csvFileName="liquidations-v2-100k-protocols"
			embedded={embedded}
			sortingState={[{ id: 'totalCollateralUsd', desc: true }]}
		/>
	)
}

export function LiquidationsOverviewChainsTable({
	rows,
	embedded = false,
	leadingControls = null
}: { rows: Array<OverviewChainRow> } & LiquidationsTableProps) {
	return (
		<TableWithSearch
			data={rows}
			columns={overviewChainColumns}
			header={embedded ? null : 'Chains'}
			leadingControls={leadingControls}
			columnToSearch="name"
			placeholder="Search chains..."
			csvFileName="liquidations-v2-100k-chains"
			embedded={embedded}
			sortingState={[{ id: 'totalCollateralUsd', desc: true }]}
		/>
	)
}

export function LiquidationsProtocolChainsTable({
	rows,
	embedded = false,
	leadingControls = null
}: { rows: Array<ProtocolChainRow> } & LiquidationsTableProps) {
	return (
		<TableWithSearch
			data={rows}
			columns={protocolChainColumns}
			header={embedded ? null : 'Chains'}
			leadingControls={leadingControls}
			columnToSearch="name"
			placeholder="Search chains..."
			csvFileName="liquidations-v2-100k-protocol-chains"
			embedded={embedded}
			sortingState={[{ id: 'totalCollateralUsd', desc: true }]}
		/>
	)
}

export function LiquidationsPositionsTable({
	rows,
	ownerBlockExplorers,
	header,
	embedded = false,
	leadingControls = null
}: {
	rows: Array<LiquidationPosition>
	ownerBlockExplorers: BlockExplorersResponse
	header: string
} & LiquidationsTableProps) {
	const [searchValue, setSearchValue] = React.useState('')
	const deferredSearchValue = React.useDeferredValue(searchValue)
	const searchIndex = React.useMemo(() => createLiquidationPositionSearchIndex(rows), [rows])
	const filteredRows = React.useMemo(
		() => filterLiquidationPositions(rows, searchIndex, deferredSearchValue),
		[rows, searchIndex, deferredSearchValue]
	)

	return (
		<LiquidationsExplorerProvider blockExplorers={ownerBlockExplorers}>
			<TableWithSearch
				data={filteredRows}
				columns={positionColumns}
				header={embedded ? null : header}
				leadingControls={leadingControls}
				customFilters={
					<label className={searchFieldInlineWrapperStyles}>
						<span className="sr-only">Search positions</span>
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						<input
							onInput={(e) => setSearchValue(e.currentTarget.value)}
							placeholder="Search positions by protocol, chain, owner, or collateral"
							className={searchFieldInputStyles}
						/>
					</label>
				}
				csvFileName="liquidations-v2-100k-positions"
				embedded={embedded}
				sortingState={[{ id: 'collateralAmountUsd', desc: true }]}
			/>
		</LiquidationsExplorerProvider>
	)
}
