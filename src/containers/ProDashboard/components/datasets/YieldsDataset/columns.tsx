import { createColumnHelper, type TableOptions } from '@tanstack/react-table'
import { IconsRow } from '~/components/IconsRow'
import { toChainIconItems, yieldsChainHref } from '~/components/IconsRow/utils'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { PercentChange } from '~/ui/PercentChange'
import { formatUsd } from '~/utils/numberFormat'
import type { ProYieldRow } from '../../../yieldData'
import type { tableFeaturesConfig } from './useYieldsTable'

export const YIELDS_COLUMN_IDS = [
	'pool',
	'project',
	'chains',
	'tvl',
	'apy',
	'apyBase',
	'apyReward',
	'apyMean30d',
	'stabilityRating',
	'volumeUsd1d',
	'ilRisk',
	'apyBorrow',
	'totalSupplyUsd',
	'totalBorrowUsd',
	'totalAvailableUsd',
	'ltv'
] as const
export const YIELDS_COLUMN_ID_SET = new Set<string>(YIELDS_COLUMN_IDS)

export type YieldColumnId = (typeof YIELDS_COLUMN_IDS)[number]

function PercentCell({ value, bold = false }: { value: number | null | undefined; bold?: boolean }) {
	if (value == null) return <>-</>
	return bold ? <PercentChange percent={value} noSign fontWeight={700} /> : <PercentChange percent={value} noSign />
}

function DollarCell({ value }: { value: number | null | undefined }) {
	return value == null ? (
		<>-</>
	) : (
		<>{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</>
	)
}

const columnHelper = createColumnHelper<typeof tableFeaturesConfig, ProYieldRow>()

export const yieldsDatasetColumns: TableOptions<typeof tableFeaturesConfig, ProYieldRow>['columns'] =
	columnHelper.columns([
		columnHelper.accessor('pool', {
			header: 'Pool',
			id: 'pool',
			enableSorting: false,
			cell: ({ row }) => (
				<span className="relative flex items-center gap-2 pl-6">
					<TokenLogo
						size={20}
						name={row.original.projectslug}
						kind="token"
						alt={`Logo of ${row.original.project}`}
						data-lgonly
					/>
					<BasicLink href={`/yields/pool/${row.original.configID}`} className="truncate text-sm font-medium text-link">
						{row.original.pool}
					</BasicLink>
					{row.original.poolMeta ? <span className="text-xs text-secondary">{row.original.poolMeta}</span> : null}
				</span>
			),
			size: 240
		}),
		columnHelper.accessor('project', {
			header: 'Protocol',
			cell: ({ row }) => (
				<BasicLink href={`/yields?protocol=${encodeURIComponent(row.original.project)}`} className="text-sm text-link">
					{row.original.project}
				</BasicLink>
			),
			size: 140,
			meta: { align: 'end' }
		}),
		columnHelper.accessor('chains', {
			header: 'Chain',
			enableSorting: false,
			cell: ({ row }) => <IconsRow items={toChainIconItems(row.original.chains, (chain) => yieldsChainHref(chain))} />,
			size: 60,
			meta: { align: 'end' }
		}),
		columnHelper.accessor((row) => row.tvl ?? undefined, {
			id: 'tvl',
			header: 'TVL',
			cell: ({ row }) => <DollarCell value={row.original.tvl} />,
			size: 120,
			meta: { align: 'end' }
		}),
		columnHelper.accessor((row) => row.apy ?? undefined, {
			id: 'apy',
			header: 'Supply APY',
			cell: ({ row }) => <PercentCell value={row.original.apy} bold />,
			size: 110,
			meta: { align: 'end' }
		}),
		columnHelper.accessor((row) => row.apyBase ?? undefined, {
			id: 'apyBase',
			header: 'Base APY',
			cell: ({ row }) => <PercentCell value={row.original.apyBase} />,
			size: 100,
			meta: { align: 'end' }
		}),
		columnHelper.accessor((row) => row.apyReward ?? undefined, {
			id: 'apyReward',
			header: 'Reward APY',
			cell: ({ row }) => (
				<span className="flex items-center justify-end gap-1">
					<PercentCell value={row.original.apyReward} />
					{row.original.rewardTokensSymbols.length > 0 ? (
						<span className="text-xs text-secondary">({row.original.rewardTokensSymbols.join(', ')})</span>
					) : null}
				</span>
			),
			size: 150,
			meta: { align: 'end' }
		}),
		columnHelper.accessor((row) => row.apyMean30d ?? undefined, {
			id: 'apyMean30d',
			header: '30d Avg APY',
			cell: ({ row }) => <PercentCell value={row.original.apyMean30d} />,
			size: 120,
			meta: { align: 'end' }
		}),
		columnHelper.accessor('stabilityRating', {
			header: '30d Stability',
			cell: ({ row }) => <span className="capitalize">{row.original.stabilityRating ?? '-'}</span>,
			size: 120,
			meta: { align: 'end' }
		}),
		columnHelper.accessor((row) => row.volumeUsd1d ?? undefined, {
			id: 'volumeUsd1d',
			header: '24h Volume',
			cell: ({ row }) => <DollarCell value={row.original.volumeUsd1d} />,
			size: 120,
			meta: { align: 'end' }
		}),
		columnHelper.accessor('ilRisk', {
			header: 'IL Risk',
			cell: ({ getValue }) => (getValue() == null ? '-' : getValue() ? 'Yes' : 'No'),
			size: 80,
			meta: { align: 'end' }
		}),
		columnHelper.accessor((row) => row.apyBorrow ?? undefined, {
			id: 'apyBorrow',
			header: 'Borrow Cost APY',
			cell: ({ row }) => <PercentCell value={row.original.apyBorrow} />,
			size: 130,
			meta: { align: 'end' }
		}),
		columnHelper.accessor((row) => row.totalSupplyUsd ?? undefined, {
			id: 'totalSupplyUsd',
			header: 'Total Supplied',
			cell: ({ row }) => <DollarCell value={row.original.totalSupplyUsd} />,
			size: 130,
			meta: { align: 'end' }
		}),
		columnHelper.accessor((row) => row.totalBorrowUsd ?? undefined, {
			id: 'totalBorrowUsd',
			header: 'Total Borrowed',
			cell: ({ row }) => <DollarCell value={row.original.totalBorrowUsd} />,
			size: 130,
			meta: { align: 'end' }
		}),
		columnHelper.accessor((row) => row.totalAvailableUsd ?? undefined, {
			id: 'totalAvailableUsd',
			header: 'Available',
			cell: ({ row }) => <DollarCell value={row.original.totalAvailableUsd} />,
			size: 120,
			meta: { align: 'end' }
		}),
		columnHelper.accessor((row) => row.ltv ?? undefined, {
			id: 'ltv',
			header: 'LTV',
			cell: ({ row }) => {
				const value = row.original.ltv
				return <PercentCell value={value == null ? null : value * 100} />
			},
			size: 80,
			meta: { align: 'end' }
		})
	])
