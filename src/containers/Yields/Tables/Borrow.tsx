import { createColumnHelper } from '@tanstack/react-table'
import { IconsRow } from '~/components/IconsRow'
import { chainHref, toChainIconItems } from '~/components/IconsRow/utils'
import type { paginatedTableFeatures } from '~/components/Table/features/pagination'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import type { MarketTableRow, RouteTableRow } from '../data/types'
import { hasPart } from '../domain/apyPresentation'
import { NameYield, PoolNameLockup } from './Name'
import { PaginatedYieldsTable } from './PaginatedYieldsTable'
import type { IYieldsTableProps, YieldsTableAppearance } from './types'
import {
	ApyWindowHeader,
	AvailableCell,
	EmptyCell,
	SignedApyCell,
	TotalApyCell,
	type SignedTipRow
} from './YieldsCells'

// Net-APY breakdown for an unleveraged route: each leg split into its resolved-view components
// (Supply − Borrow cost = Net). Borrow reward offsets cost so it reads as a positive contribution;
// borrow base cost + borrow intrinsic are the negatives.
function routeNetRows(row: RouteTableRow): Array<SignedTipRow> {
	const { supplyApyBase, supplyApyReward, supplyApyIntrinsic, borrowApyBase, borrowApyReward, borrowApyIntrinsic } = row
	const rows: Array<SignedTipRow> = []
	if (supplyApyBase != null) rows.push({ label: 'Supply Base', value: supplyApyBase, signed: 'plus' })
	if (hasPart(supplyApyReward)) rows.push({ label: 'Supply Reward', value: supplyApyReward, signed: 'plus' })
	if (hasPart(supplyApyIntrinsic)) rows.push({ label: 'Supply Intrinsic', value: supplyApyIntrinsic, signed: 'plus' })
	if (borrowApyBase != null) rows.push({ label: 'Borrow Base Cost', value: borrowApyBase, signed: 'minus' })
	if (hasPart(borrowApyReward)) rows.push({ label: 'Borrow Reward', value: borrowApyReward, signed: 'plus' })
	if (hasPart(borrowApyIntrinsic)) rows.push({ label: 'Borrow Intrinsic', value: borrowApyIntrinsic, signed: 'minus' })
	return rows
}

function LtvCell({ value }: { value: number | null | undefined }) {
	if (value == null) return <EmptyCell />
	return (
		<span>{`${formatPercent(value, { input: 'fraction', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}</span>
	)
}

function UsdCell({ value }: { value: number | null | undefined }) {
	if (value == null) return <EmptyCell />
	return <span>{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</span>
}

// Shared server-paginated table for the /yields/borrow markets & routes views.
// Same tanstack + PaginatedTable infra the pools table uses, with bespoke column
// defs (not the pools config). Column ids double as the server `sortBy` keys.
const marketHelper = createColumnHelper<typeof paginatedTableFeatures, MarketTableRow>()

const marketColumns = marketHelper.columns([
	marketHelper.accessor('pool', {
		id: 'market',
		header: 'Market',
		enableSorting: false,
		cell: ({ getValue, row }) => (
			<PoolNameLockup
				rowId={row.id}
				pegDeviation={row.original.pegDeviation}
				pegTokenSymbol={row.original.pegTokenSymbol}
				pegConsequence="collateral and loan values may not reflect reality"
				value={getValue()}
				configID={row.original.configID}
				url={row.original.url}
				poolMeta={row.original.poolMeta}
				bookmark={false}
				hasRiskData={row.original.hasRiskData}
			/>
		),
		meta: { headerClassName: 'min-w-[200px]' }
	}),
	marketHelper.accessor('project', {
		id: 'project',
		header: 'Protocol',
		enableSorting: false,
		cell: ({ row }) => (
			<NameYield
				project={row.original.project}
				projectslug={row.original.projectslug}
				airdrop={row.original.airdrop}
				raiseValuationUsd={row.original.raiseValuationUsd}
			/>
		),
		meta: { headerClassName: 'min-w-[160px]' }
	}),
	marketHelper.accessor('chains', {
		id: 'chains',
		header: 'Chain',
		enableSorting: false,
		cell: (info) => <IconsRow items={toChainIconItems(info.getValue(), (chain) => chainHref('/chain', chain))} />,
		meta: { align: 'end' }
	}),
	marketHelper.accessor((row) => row.supplyApy ?? undefined, {
		id: 'supply_apy',
		header: () => <ApyWindowHeader label="Supply APY" />,
		enableSorting: true,
		cell: ({ row }) => (
			<TotalApyCell
				value={row.original.supplyApy}
				kind="supply"
				parts={{
					base: row.original.supplyApyBase,
					reward: row.original.supplyApyReward,
					intrinsic: row.original.supplyApyIntrinsic
				}}
				intrinsicSource={row.original.supplyIntrinsicSourceSymbol}
				rewardSymbols={row.original.supplyRewardTokensSymbols}
			/>
		),
		meta: { align: 'end' }
	}),
	marketHelper.accessor((row) => row.borrowApy ?? undefined, {
		id: 'borrow_apy',
		header: () => <ApyWindowHeader label="Borrow APY" />,
		enableSorting: true,
		cell: ({ row }) => (
			<TotalApyCell
				value={row.original.borrowApy}
				kind="borrow"
				parts={{
					base: row.original.borrowApyBase,
					reward: row.original.borrowApyReward,
					intrinsic: row.original.borrowApyIntrinsic
				}}
				intrinsicSource={row.original.borrowIntrinsicSourceSymbol}
				rewardSymbols={row.original.borrowRewardTokensSymbols}
			/>
		),
		meta: { align: 'end' }
	}),
	marketHelper.accessor((row) => row.availableBorrowUsd ?? undefined, {
		id: 'available_borrow',
		header: 'Available',
		enableSorting: true,
		cell: ({ row }) => (
			<AvailableCell available={row.original.availableBorrowUsd} capacityFilled={row.original.borrowCapacityFilled} />
		),
		meta: {
			headerClassName: 'min-w-[130px]',
			align: 'end',
			headerHelperText: 'Amount available to borrow after caps'
		}
	}),
	marketHelper.accessor((row) => row.totalBorrowUsd ?? undefined, {
		id: 'total_borrow',
		header: 'Borrowed',
		enableSorting: true,
		cell: (info) => <UsdCell value={info.getValue()} />,
		meta: { align: 'end' }
	}),
	marketHelper.accessor((row) => row.ltv ?? undefined, {
		id: 'ltv',
		header: 'LTV',
		enableSorting: true,
		cell: ({ row }) => <LtvCell value={row.original.ltv} />,
		// The widest value ("88.88%") is wider than the "LTV" header.
		meta: { headerClassName: 'min-w-[78px]', align: 'end' }
	})
])

const routeHelper = createColumnHelper<typeof paginatedTableFeatures, RouteTableRow>()

const routeColumns = routeHelper.columns([
	routeHelper.accessor('pool', {
		id: 'route',
		header: 'Collateral / Borrow',
		enableSorting: false,
		cell: ({ getValue, row }) => (
			<PoolNameLockup
				rowId={row.id}
				pegDeviation={row.original.pegDeviation}
				pegTokenSymbol={row.original.pegTokenSymbol}
				pegConsequence="collateral and loan values may not reflect reality"
				value={getValue()}
				configID={row.original.configID}
				url={row.original.url}
				poolMeta={row.original.poolMeta}
				bookmark={false}
				hasRiskData={row.original.hasRiskData}
			/>
		),
		meta: { headerClassName: 'min-w-[165px]' }
	}),
	routeHelper.accessor('project', {
		id: 'project',
		header: 'Protocol',
		enableSorting: false,
		cell: ({ row }) => (
			<NameYield
				project={row.original.project}
				projectslug={row.original.projectslug}
				airdrop={row.original.airdrop}
				raiseValuationUsd={row.original.raiseValuationUsd}
			/>
		),
		meta: { headerClassName: 'min-w-[160px]' }
	}),
	routeHelper.accessor('chains', {
		id: 'chains',
		header: 'Chain',
		enableSorting: false,
		cell: (info) => <IconsRow items={toChainIconItems(info.getValue(), (chain) => chainHref('/chain', chain))} />,
		meta: { align: 'end' }
	}),
	routeHelper.accessor((row) => row.netApy ?? undefined, {
		id: 'net_apy',
		header: () => <ApyWindowHeader label="Net APY" />,
		enableSorting: true,
		cell: ({ row }) => {
			// Unleveraged route: Supply − Borrow cost = Net. The breakdown splits each leg into its
			// resolved-view components; a defensive fallback shows leg totals if no split is present.
			const legRows = routeNetRows(row.original)
			const tooltipRows: Array<SignedTipRow> =
				legRows.length > 0
					? legRows
					: [
							...(row.original.supplyApy != null
								? [{ label: 'Supply', value: row.original.supplyApy, signed: 'plus' as const }]
								: []),
							...(row.original.borrowApy != null
								? [{ label: 'Borrow Cost', value: row.original.borrowApy, signed: 'minus' as const }]
								: [])
						]
			return <SignedApyCell value={row.original.netApy} summaryLabel="Net" tooltipRows={tooltipRows} />
		},
		meta: {
			align: 'end',
			headerHelperText: 'Net APY of the route — supply yield minus borrow cost'
		}
	}),
	routeHelper.accessor((row) => row.supplyApy ?? undefined, {
		id: 'supply_apy',
		header: () => <ApyWindowHeader label="Supply APY" />,
		enableSorting: true,
		cell: ({ row }) => (
			<TotalApyCell
				value={row.original.supplyApy}
				kind="supply"
				parts={{
					base: row.original.supplyApyBase,
					reward: row.original.supplyApyReward,
					intrinsic: row.original.supplyApyIntrinsic
				}}
				intrinsicSource={row.original.supplyIntrinsicSourceSymbol}
				rewardSymbols={row.original.supplyRewardTokensSymbols}
			/>
		),
		meta: { align: 'end' }
	}),
	routeHelper.accessor((row) => row.borrowApy ?? undefined, {
		id: 'borrow_apy',
		header: () => <ApyWindowHeader label="Borrow APY" />,
		enableSorting: true,
		cell: ({ row }) => (
			<TotalApyCell
				value={row.original.borrowApy}
				kind="borrow"
				parts={{
					base: row.original.borrowApyBase,
					reward: row.original.borrowApyReward,
					intrinsic: row.original.borrowApyIntrinsic
				}}
				intrinsicSource={row.original.borrowIntrinsicSourceSymbol}
				rewardSymbols={row.original.borrowRewardTokensSymbols}
			/>
		),
		meta: { align: 'end' }
	}),
	routeHelper.accessor((row) => row.availableBorrowUsd ?? undefined, {
		id: 'available_borrow',
		header: 'Available',
		enableSorting: true,
		cell: ({ row }) => (
			<AvailableCell available={row.original.availableBorrowUsd} capacityFilled={row.original.borrowCapacityFilled} />
		),
		meta: { headerClassName: 'min-w-[100px]', align: 'end', headerHelperText: 'Amount available to borrow after caps' }
	}),
	routeHelper.accessor((row) => row.ltv ?? undefined, {
		id: 'ltv',
		header: 'LTV',
		enableSorting: true,
		cell: ({ row }) => <LtvCell value={row.original.ltv} />,
		// The widest value ("88.88%") is wider than the "LTV" header.
		meta: { headerClassName: 'min-w-[78px]', align: 'end' }
	})
])

export function PaginatedBorrowMarketsTable({
	appearance = 'standalone',
	...props
}: IYieldsTableProps<MarketTableRow> & { appearance?: YieldsTableAppearance }) {
	return (
		<PaginatedYieldsTable
			{...props}
			columns={marketColumns}
			initialPageSize={props.initialPageSize ?? 50}
			manualPagination={props.manualPagination ?? true}
			manualSorting={props.manualSorting ?? true}
			tableClassName="[&_td]:py-1.5"
			shell={appearance === 'embedded' ? 'none' : 'default'}
		/>
	)
}

export function PaginatedBorrowRoutesTable({
	appearance = 'standalone',
	...props
}: IYieldsTableProps<RouteTableRow> & { appearance?: YieldsTableAppearance }) {
	return (
		<PaginatedYieldsTable
			{...props}
			columns={routeColumns}
			initialPageSize={props.initialPageSize ?? 50}
			manualPagination={props.manualPagination ?? true}
			manualSorting={props.manualSorting ?? true}
			tableClassName="[&_td]:py-1.5"
			shell={appearance === 'embedded' ? 'none' : 'default'}
		/>
	)
}
