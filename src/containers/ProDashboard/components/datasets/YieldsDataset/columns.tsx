import type { ColumnDef } from '@tanstack/react-table'
import { IconsRow } from '~/components/IconsRow'
import { toChainIconItems, yieldsChainHref } from '~/components/IconsRow/utils'
import { BasicLink } from '~/components/Link'
import { PercentChange } from '~/components/PercentChange'
import { TokenLogo } from '~/components/TokenLogo'
import { formattedNum } from '~/utils'
import type { ProYieldRow } from './data'

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
	return value == null ? <>-</> : <PercentChange percent={value} noSign fontWeight={bold ? 700 : undefined} />
}

function DollarCell({ value }: { value: number | null | undefined }) {
	return value == null ? <>-</> : <>{formattedNum(value, true)}</>
}

export const yieldsDatasetColumns: ColumnDef<ProYieldRow>[] = [
	{
		header: 'Pool',
		id: 'pool',
		accessorFn: (row) => row.pool,
		enableSorting: false,
		cell: ({ getValue, row }) => (
			<span className="relative flex items-center gap-2 pl-6">
				<TokenLogo
					size={20}
					name={row.original.projectslug}
					kind="token"
					alt={`Logo of ${row.original.project}`}
					data-lgonly
				/>
				<BasicLink href={`/yields/pool/${row.original.configID}`} className="truncate text-sm font-medium text-link">
					{getValue() as string}
				</BasicLink>
				{row.original.poolMeta ? <span className="text-xs text-secondary">{row.original.poolMeta}</span> : null}
			</span>
		),
		size: 240
	},
	{
		header: 'Protocol',
		accessorKey: 'project',
		cell: ({ getValue, row }) => (
			<BasicLink href={`/yields?protocol=${encodeURIComponent(row.original.project)}`} className="text-sm text-link">
				{getValue() as string}
			</BasicLink>
		),
		size: 140,
		meta: { align: 'end' }
	},
	{
		header: 'Chain',
		accessorKey: 'chains',
		enableSorting: false,
		cell: (info) => (
			<IconsRow items={toChainIconItems(info.getValue() as string[], (chain) => yieldsChainHref(chain))} />
		),
		size: 60,
		meta: { align: 'end' }
	},
	{
		header: 'TVL',
		accessorKey: 'tvl',
		cell: ({ getValue }) => <DollarCell value={getValue() as number | null} />,
		size: 120,
		meta: { align: 'end' }
	},
	{
		header: 'Supply APY',
		accessorKey: 'apy',
		cell: ({ getValue }) => <PercentCell value={getValue() as number | null} bold />,
		size: 110,
		meta: { align: 'end' }
	},
	{
		header: 'Base APY',
		accessorKey: 'apyBase',
		cell: ({ getValue }) => <PercentCell value={getValue() as number | null} />,
		size: 100,
		meta: { align: 'end' }
	},
	{
		header: 'Reward APY',
		accessorKey: 'apyReward',
		cell: ({ getValue, row }) => (
			<span className="flex items-center justify-end gap-1">
				<PercentCell value={getValue() as number | null} />
				{row.original.rewardTokensSymbols.length ? (
					<span className="text-xs text-secondary">({row.original.rewardTokensSymbols.join(', ')})</span>
				) : null}
			</span>
		),
		size: 150,
		meta: { align: 'end' }
	},
	{
		header: '30d Avg APY',
		accessorKey: 'apyMean30d',
		cell: ({ getValue }) => <PercentCell value={getValue() as number | null} />,
		size: 120,
		meta: { align: 'end' }
	},
	{
		header: '30d Stability',
		accessorKey: 'stabilityRating',
		cell: ({ getValue }) => <span className="capitalize">{(getValue() as string | null) ?? '-'}</span>,
		size: 120,
		meta: { align: 'end' }
	},
	{
		header: '24h Volume',
		accessorKey: 'volumeUsd1d',
		cell: ({ getValue }) => <DollarCell value={getValue() as number | null} />,
		size: 120,
		meta: { align: 'end' }
	},
	{
		header: 'IL Risk',
		accessorKey: 'ilRisk',
		cell: ({ getValue }) => ((getValue() as boolean) ? 'Yes' : 'No'),
		size: 80,
		meta: { align: 'end' }
	},
	{
		header: 'Borrow Cost APY',
		accessorKey: 'apyBorrow',
		cell: ({ getValue }) => <PercentCell value={getValue() as number | null} />,
		size: 130,
		meta: { align: 'end' }
	},
	{
		header: 'Total Supplied',
		accessorKey: 'totalSupplyUsd',
		cell: ({ getValue }) => <DollarCell value={getValue() as number | null} />,
		size: 130,
		meta: { align: 'end' }
	},
	{
		header: 'Total Borrowed',
		accessorKey: 'totalBorrowUsd',
		cell: ({ getValue }) => <DollarCell value={getValue() as number | null} />,
		size: 130,
		meta: { align: 'end' }
	},
	{
		header: 'Available',
		accessorKey: 'totalAvailableUsd',
		cell: ({ getValue }) => <DollarCell value={getValue() as number | null} />,
		size: 120,
		meta: { align: 'end' }
	},
	{
		header: 'LTV',
		accessorKey: 'ltv',
		cell: ({ getValue }) => {
			const value = getValue() as number | null
			return <PercentCell value={value == null ? null : value * 100} />
		},
		size: 80,
		meta: { align: 'end' }
	}
]
