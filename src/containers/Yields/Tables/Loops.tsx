import { createColumnHelper, type TableOptions } from '@tanstack/react-table'
import { IconsRow } from '~/components/IconsRow'
import { chainHref, toChainIconItems } from '~/components/IconsRow/utils'
import { formatPercent, formatRatio } from '~/utils/numberFormat'
import type { LoopTableRow } from '../data/types'
import { hasPart } from '../domain/apyPresentation'
import { NameYield, PoolNameLockup } from './Name'
import { PaginatedYieldsTable } from './PaginatedYieldsTable'
import type { IYieldsTableProps } from './types'
import {
	ApyWindowHeader,
	AvailableCell,
	EmptyCell,
	type SignedTipRow,
	SignedApyCell,
	TotalApyCell
} from './YieldsCells'

// Looped-APY breakdown: split each leg into its resolved-view components, scaled by the loop
// exposure multipliers (supply = leverage, borrow = leverage − 1). The scaled legs subtotal to
// Looped APY. Borrow reward offsets cost, so it reads as a positive (+) contribution; borrow base
// cost is the only negative.
function loopLegRows(row: LoopTableRow): SignedTipRow[] {
	const { leverage, supplyApyBase, supplyApyReward, supplyApyIntrinsic, borrowApyBase, borrowApyReward } = row
	const sMult = leverage ?? 1
	const bMult = leverage != null ? leverage - 1 : 1
	const sMultProp = leverage != null ? sMult : undefined
	const bMultProp = leverage != null ? bMult : undefined
	const rows: SignedTipRow[] = []
	if (supplyApyBase != null)
		rows.push({
			label: 'Supply base',
			value: supplyApyBase * sMult,
			signed: 'plus',
			...(sMultProp !== undefined ? { multiple: sMultProp } : {})
		})
	if (hasPart(supplyApyReward))
		rows.push({
			label: 'Supply reward',
			value: supplyApyReward * sMult,
			signed: 'plus',
			...(sMultProp !== undefined ? { multiple: sMultProp } : {})
		})
	if (hasPart(supplyApyIntrinsic))
		rows.push({
			label: 'Supply intrinsic',
			value: supplyApyIntrinsic * sMult,
			signed: 'plus',
			...(sMultProp !== undefined ? { multiple: sMultProp } : {})
		})
	if (borrowApyBase != null)
		rows.push({
			label: 'Borrow base cost',
			value: borrowApyBase * bMult,
			signed: 'minus',
			...(bMultProp !== undefined ? { multiple: bMultProp } : {})
		})
	if (hasPart(borrowApyReward))
		rows.push({
			label: 'Borrow reward',
			value: borrowApyReward * bMult,
			signed: 'plus',
			...(bMultProp !== undefined ? { multiple: bMultProp } : {})
		})
	return rows
}

function LtvCell({ value }: { value: number | null | undefined }) {
	if (value == null) return <EmptyCell />
	return (
		<span>{`${formatPercent(value, { input: 'fraction', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}</span>
	)
}

function LeverageCell({ value }: { value: number | null | undefined }) {
	if (value == null) return <EmptyCell />
	return (
		<span>
			{formatRatio(value, { maximumFractionDigits: 1 })}
			<span className="opacity-70">x</span>
		</span>
	)
}

// Server-paginated table for the /yields/loop view. Same tanstack + PaginatedTable
// infra the borrow tables use, with bespoke loop column defs. Column ids double as the
// server `sortBy` keys (the loops handler exposes loop_apy / supply_apy / borrow_apy /
// available_borrow / ltv accessors).
const loopHelper = createColumnHelper<LoopTableRow>()

// Column order / labels: Token, Protocol, Chain, Leverage, Supply APY, Borrow APY,
// Looped APY, Available, Loop LTV.
const loopColumns: TableOptions<LoopTableRow>['columns'] = [
	loopHelper.accessor('pool', {
		id: 'token',
		header: 'Token',
		enableSorting: false,
		cell: ({ getValue, row }) => (
			// Loops carry NO bookmark (deliberate) — the lockup's inline rank leads directly and the
			// leading gap collapses with no bookmark slot.
			<PoolNameLockup
				rowId={row.id}
				pegDeviation={row.original.pegDeviation}
				pegTokenSymbol={row.original.pegTokenSymbol}
				pegConsequence="the looped position is built on a depegged asset"
				value={getValue()}
				configID={row.original.configID}
				url={row.original.url}
				poolMeta={row.original.poolMeta}
				bookmark={false}
				hasRiskData={row.original.hasRiskData}
			/>
		),
		meta: { headerClassName: 'w-[160px]' }
	}),
	loopHelper.accessor('project', {
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
		meta: { headerClassName: 'w-[130px]' }
	}),
	loopHelper.accessor('chains', {
		id: 'chains',
		header: 'Chain',
		enableSorting: false,
		cell: (info) => (
			<IconsRow items={toChainIconItems(info.getValue() as string[], (chain) => chainHref('/chain', chain))} />
		),
		meta: { headerClassName: 'w-[50px] min-w-[50px]', align: 'end' }
	}),
	loopHelper.accessor((row) => row.loopApy ?? undefined, {
		id: 'loop_apy',
		header: () => <ApyWindowHeader label="Looped APY" />,
		enableSorting: true,
		cell: ({ row }) => {
			// The leveraged legs — split into their resolved-view base/reward components and scaled by
			// the loop multipliers (supply = leverage, borrow = leverage − 1) — subtotal to Looped APY.
			const { ltv, loopCount, supplyApy, borrowApy, loopApy, leverage } = row.original
			const loops = `${loopCount} loop${loopCount === 1 ? '' : 's'}`
			const note =
				ltv != null
					? `Recursive loop · ${formatPercent(ltv, { input: 'fraction', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} LTV · ${loops}`
					: `Recursive loop · ${loops}`
			const legRows = loopLegRows(row.original)
			// Defensive fallback to leg totals if a row somehow carries no component split.
			const supplyMult = leverage ?? 1
			const borrowMult = leverage != null ? leverage - 1 : 1
			const tooltipRows: SignedTipRow[] = legRows.length
				? legRows
				: [
						...(supplyApy != null
							? [
									{
										label: 'Supply',
										value: supplyApy * supplyMult,
										signed: 'plus' as const,
										...(leverage != null ? { multiple: supplyMult } : {})
									}
								]
							: []),
						...(borrowApy != null
							? [
									{
										label: 'Borrow cost',
										value: borrowApy * borrowMult,
										signed: 'minus' as const,
										...(leverage != null ? { multiple: borrowMult } : {})
									}
								]
							: [])
					]
			return <SignedApyCell value={loopApy} summaryLabel="Loop APY" note={note} tooltipRows={tooltipRows} />
		},
		meta: {
			headerClassName: 'w-[160px] min-w-[160px]',
			align: 'end',
			headerHelperText: 'Net APY of the looped position — leveraged supply yield minus borrow cost'
		}
	}),
	loopHelper.accessor((row) => row.leverage ?? undefined, {
		id: 'ltv',
		header: 'Leverage',
		enableSorting: true,
		cell: ({ row }) => <LeverageCell value={row.original.leverage} />,
		meta: {
			headerClassName: 'w-[100px] min-w-[100px]',
			align: 'end',
			headerHelperText: 'Looped exposure multiplier, derived from LTV'
		}
	}),
	loopHelper.accessor((row) => row.supplyApy ?? undefined, {
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
		meta: { headerClassName: 'w-[140px] min-w-[140px]', align: 'end' }
	}),
	loopHelper.accessor((row) => row.borrowApy ?? undefined, {
		id: 'borrow_apy',
		header: () => <ApyWindowHeader label="Borrow APY" />,
		enableSorting: true,
		cell: ({ row }) => (
			<TotalApyCell
				value={row.original.borrowApy}
				kind="borrow"
				parts={{ base: row.original.borrowApyBase, reward: row.original.borrowApyReward }}
				rewardSymbols={row.original.borrowRewardTokensSymbols}
			/>
		),
		meta: { headerClassName: 'w-[130px] min-w-[130px]', align: 'end' }
	}),
	loopHelper.accessor((row) => row.availableBorrowUsd ?? undefined, {
		id: 'available_borrow',
		header: 'Available',
		enableSorting: true,
		cell: ({ row }) => (
			<AvailableCell available={row.original.availableBorrowUsd} capacityFilled={row.original.borrowCapacityFilled} />
		),
		meta: {
			headerClassName: 'w-[110px] min-w-[110px]',
			align: 'end',
			headerHelperText: 'Amount available to borrow after caps'
		}
	}),
	loopHelper.accessor((row) => row.ltv ?? undefined, {
		id: 'loop_ltv',
		header: 'LTV',
		enableSorting: true,
		cell: ({ row }) => <LtvCell value={row.original.ltv} />,
		meta: { headerClassName: 'w-[80px] min-w-[80px]', align: 'end' }
	})
]

export function PaginatedLoopsTable(props: IYieldsTableProps<LoopTableRow>) {
	return (
		<PaginatedYieldsTable
			{...props}
			columns={loopColumns}
			initialPageSize={props.initialPageSize ?? 50}
			manualPagination={props.manualPagination ?? true}
			manualSorting={props.manualSorting ?? true}
			tableClassName="min-w-[920px] [&_td]:py-1.5"
		/>
	)
}
