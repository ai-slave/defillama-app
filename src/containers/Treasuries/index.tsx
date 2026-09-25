import { createColumnHelper } from '@tanstack/react-table'
import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { BasicLink } from '~/components/Link'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { Hovercard } from '~/ui/Hovercard'
import { searchFieldInlineWrapperStyles } from '~/ui/Input'
import { PanelTitle, PanelHeader } from '~/ui/Panel'
import { getDominancePercent } from '~/utils'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import type { ITreasuryRow, TreasuryTokenBreakdowns } from './types'

const columnHelper = createColumnHelper<SearchTableFeatures, ITreasuryRow>()

/** Entity treasuries have no own token, core TVL, or market cap, so those columns only exist for protocols. */
export function treasuryTableColumns(entity: boolean) {
	if (!entity) return columns
	return columns.filter((c) => {
		const key = c.id ?? ('accessorKey' in c ? String(c.accessorKey) : '')
		return !['ownTokens', 'coreTvl', 'mcap'].includes(key)
	})
}

export function Treasuries({ data, entity }: { data: Array<ITreasuryRow>; entity: boolean }) {
	const tableColumns = useMemo(() => treasuryTableColumns(entity), [entity])

	const sortingState = entity ? [{ id: 'tvl', desc: true }] : [{ id: 'coreTvl', desc: true }]

	return (
		<SearchTableProvider options={{ data, columns: tableColumns, initialState: { sorting: sortingState } }}>
			<Card padding="none">
				<PanelHeader className="w-full justify-end">
					<PanelTitle as="h1" className="whitespace-nowrap">
						Treasuries
					</PanelTitle>
					<TableSearchInput
						columnId="name"
						placeholder="Search projects..."
						className={searchFieldInlineWrapperStyles}
					/>
					<TableCsvExport filename={entity ? 'entities' : 'treasuries'} />
				</PanelHeader>
				<VirtualSearchTableView />
			</Card>
		</SearchTableProvider>
	)
}

const columns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const name = getValue()
			const protocolHref = row.original.protocolHref

			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<TokenLogo src={row.original.logo} data-lgonly alt={`Logo of ${name}`} />
					{protocolHref ? (
						<BasicLink href={protocolHref} className="truncate text-sm font-medium text-link">
							{name}
						</BasicLink>
					) : (
						<span className="truncate text-sm font-medium">{name}</span>
					)}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(220px,40vw)]'
		}
	}),
	columnHelper.accessor('tokenBreakdowns', {
		id: 'tokenBreakdowns',
		header: 'Breakdown',
		enableSorting: false,
		cell: (info) => {
			const breakdown = info.getValue()
			const totalBreakdown = breakdown.stablecoins + breakdown.majors + breakdown.ownTokens + breakdown.others

			if (totalBreakdown < 1) {
				return null
			}

			const dominance: Array<[keyof TreasuryTokenBreakdowns, number]> = [
				['stablecoins', getDominancePercent(breakdown.stablecoins, totalBreakdown)],
				['majors', getDominancePercent(breakdown.majors, totalBreakdown)],
				['ownTokens', getDominancePercent(breakdown.ownTokens, totalBreakdown)],
				['others', getDominancePercent(breakdown.others, totalBreakdown)]
			]
			dominance.sort((a, b) => b[1] - a[1])

			return (
				<Hovercard
					content={<BreakdownTooltipContent dominance={dominance} protocolName={info.row.original.name} />}
					contentClassName="w-max max-w-[min(20rem,var(--popover-available-width))] p-3"
					render={<button type="button" />}
					className="ml-auto flex h-5 w-full! flex-nowrap items-center bg-white"
				>
					{dominance.map((dom) => {
						const color = breakdownColor(dom[0])

						return (
							<div
								key={JSON.stringify([dom[0], info.row.original.name])}
								style={{ width: `${dom[1]}%`, background: color }}
								className="h-5"
							/>
						)
					})}
				</Hovercard>
			)
		},
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.tokenBreakdowns.stablecoins, {
		id: 'stablecoins',
		header: 'Stablecoins',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[115px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.tokenBreakdowns.majors, {
		id: 'majors',
		header: 'Majors (BTC, ETH)',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.tokenBreakdowns.ownTokens, {
		id: 'ownTokens',
		header: 'Own Tokens',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.tokenBreakdowns.others, {
		id: 'others',
		header: 'Others',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[100px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.coreTvl, {
		id: 'coreTvl',
		header: 'Total excl. own tokens',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[min(185px,40vw)]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.totalTvl, {
		id: 'tvl',
		header: 'Total Treasury',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[135px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => (row.mcap === 0 ? undefined : (row.mcap ?? undefined)), {
		id: 'mcap',
		header: 'Mcap',
		cell: (info) =>
			info.getValue() == null
				? null
				: formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[128px]',
			align: 'end'
		}
	})
])

const BREAKDOWN_COLORS: Record<string, string> = {
	stablecoins: '#16a34a',
	majors: '#2563eb',
	ownTokens: '#f97316',
	others: '#6d28d9'
}

const BREAKDOWN_LABELS: Record<string, string> = {
	stablecoins: 'Stablecoins',
	majors: 'Majors',
	ownTokens: 'Own Tokens',
	others: 'Others'
}

const breakdownColor = (type: string) => BREAKDOWN_COLORS[type] ?? '#f85149'

const formatBreakdownType = (type: string) => BREAKDOWN_LABELS[type] ?? type

function Breakdown({ data }: { data: [string, number] }) {
	const color = breakdownColor(data[0])
	const name = `${formatBreakdownType(data[0])} (${formatPercent(data[1], { input: 'percent' })})`

	return (
		<span className="flex flex-nowrap items-center gap-1">
			<span
				style={{ '--color': color } as CSSProperties & Record<`--${string}`, string>}
				className="size-4 rounded-xs bg-(--color)"
			/>
			<span className="min-w-0 break-words">{name}</span>
		</span>
	)
}

function BreakdownTooltipContent({
	dominance,
	protocolName
}: {
	dominance: Array<[string, number]>
	protocolName: string
}) {
	return (
		<span className="flex flex-col gap-1">
			{dominance.map((dom) => (
				<Breakdown data={dom} key={`${dom[0] + dom[1] + protocolName}tooltip-content`} />
			))}
		</span>
	)
}
