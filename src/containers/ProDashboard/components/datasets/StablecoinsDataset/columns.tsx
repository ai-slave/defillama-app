import type { ColumnDef } from '@tanstack/react-table'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { PercentChange } from '~/ui/PercentChange'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { Tooltip } from '~/ui/Tooltip'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import type { tableFeaturesConfig } from './index'
import type { StablecoinsTableRow } from './useStablecoinsData'

export const stablecoinsDatasetColumns: Array<ColumnDef<typeof tableFeaturesConfig, StablecoinsTableRow>> = [
	{
		header: 'Name',
		id: 'name',
		accessorFn: (row) => row.name,
		enableSorting: false,
		cell: ({ row }) => {
			const name = row.original.name
			const symbol = row.original.symbol

			return (
				<span className="relative flex items-center gap-2 pl-6">
					<TokenLogo name={name} kind="pegged" alt={`Logo of ${name}`} data-lgonly />
					<BasicLink href={`/stablecoin/${row.original.slug}`} className="truncate text-sm font-medium text-link">
						{name}
						{symbol && symbol !== '-' ? <span className="text-pro-text-tertiary"> ({symbol})</span> : null}
					</BasicLink>
				</span>
			)
		},
		size: 280
	},
	{
		header: 'Price',
		id: 'price',
		accessorFn: (row) => row.price ?? undefined,
		cell: ({ row }) => {
			const value = row.original.price
			const pegDeviation = row.original.pegDeviation

			return (
				<span className="flex items-center gap-1">
					{pegDeviation != null && Math.abs(pegDeviation) >= 0.5 ? (
						<Tooltip
							content={`${pegDeviation > 0 ? '+' : ''}${formatPercent(pegDeviation, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })} from peg`}
						>
							<Icon
								name="alert-triangle"
								height={14}
								width={14}
								className={pegDeviation > 0 ? 'text-success' : 'text-error'}
							/>
						</Tooltip>
					) : null}
					<span>
						{value == null ? 'N/A' : formatUsd(value, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
					</span>
				</span>
			)
		},
		size: 100,
		meta: {
			align: 'end'
		}
	},
	{
		header: 'Market Cap',
		id: 'mcap',
		accessorFn: (row) => row.mcap ?? undefined,
		cell: ({ row }) => {
			const value = row.original.mcap
			return (
				<span className="flex items-center justify-end gap-1">
					{row.original.doublecounted ? (
						<QuestionHelper text="This stablecoin is excluded from aggregate stablecoin market cap to avoid double counting." />
					) : null}
					<span className={row.original.doublecounted ? 'text-pro-text-tertiary' : ''}>
						{value == null
							? '-'
							: formatUsd(value, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
					</span>
				</span>
			)
		},
		size: 145,
		meta: {
			align: 'end'
		}
	},
	{
		header: '1d Change',
		id: 'change_1d',
		accessorFn: (row) => row.change_1d ?? undefined,
		cell: ({ row }) => {
			const value = row.original.change_1d
			return (
				<span className={value == null ? undefined : value < 0 ? 'text-error' : 'text-success'}>
					<PercentChange percent={value} />
				</span>
			)
		},
		size: 100,
		meta: {
			align: 'end'
		}
	},
	{
		header: '7d Change',
		id: 'change_7d',
		accessorFn: (row) => row.change_7d ?? undefined,
		cell: ({ row }) => {
			const value = row.original.change_7d
			return (
				<span className={value == null ? undefined : value < 0 ? 'text-error' : 'text-success'}>
					<PercentChange percent={value} />
				</span>
			)
		},
		size: 100,
		meta: {
			align: 'end'
		}
	},
	{
		header: '1m Change',
		id: 'change_1m',
		accessorFn: (row) => row.change_1m ?? undefined,
		cell: ({ row }) => {
			const value = row.original.change_1m
			return (
				<span className={value == null ? undefined : value < 0 ? 'text-error' : 'text-success'}>
					<PercentChange percent={value} />
				</span>
			)
		},
		size: 100,
		meta: {
			align: 'end'
		}
	},
	{
		header: 'Chains',
		accessorKey: 'chains',
		cell: ({ row }) => {
			const chains = row.original.chains
			const displayChains = chains.slice(0, 3)
			const remainingCount = chains.length - 3

			return (
				<Tooltip content={chains.join(', ')}>
					<span className="text-sm text-pro-text-secondary">
						{displayChains.join(', ')}
						{remainingCount > 0 ? ` +${remainingCount}` : null}
					</span>
				</Tooltip>
			)
		},
		size: 200,
		enableSorting: false
	}
]
