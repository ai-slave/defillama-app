import { createColumnHelper, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import * as React from 'react'
import { Bookmark } from '~/components/Bookmark'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { PaginatedTable } from '~/components/Table/PaginatedTable'
import { TokenLogo } from '~/components/TokenLogo'
import { Tooltip } from '~/components/Tooltip'
import { useDebouncedCallback } from '~/hooks/useDebounce'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { searchFieldIconStyles, searchFieldInputStyles } from '~/ui/Input'
import type {
	TokensDisplayTone,
	TokensPageProps,
	TokensPageStatsDisplay,
	TokensRightsSummary,
	TokensTableRow
} from './types'
import { useTokensServerTable } from './useTokensServerTable'

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const
export const TOKENS_TABLE_WIDTH_EXCLUDING_RANK = 2244
// Width of the optional "Markets" expander column (added only in the expandable/watchlist variant).
export const TOKENS_MARKETS_EXPANDER_COLUMN_WIDTH = 104
const columnHelper = createColumnHelper<TokensTableRow>()

type RightsTone = 'positive' | 'negative' | 'warning' | 'neutral'

const RIGHTS_CHIP_TONE_CLASSES: Record<RightsTone, string> = {
	positive: 'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400',
	negative: 'border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400',
	warning: 'border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-400',
	neutral: 'border-medium bg-surface text-secondary'
}

const RIGHTS_TEXT_TONE_CLASSES: Record<RightsTone, string> = {
	positive: 'text-green-700 dark:text-green-400',
	negative: 'text-red-600 dark:text-red-400',
	warning: 'text-amber-600 dark:text-amber-400',
	neutral: 'text-secondary'
}

const RIGHTS_DOT_TONE_CLASSES: Record<RightsTone, string> = {
	positive: 'bg-data-up',
	negative: 'bg-data-down',
	warning: 'bg-amber-500',
	neutral: 'bg-disabled'
}

const VALUE_TONE_CLASSES: Record<TokensDisplayTone, string> = {
	positive: 'text-data-up',
	negative: 'text-data-down',
	neutral: ''
}

type TokensTableStyle = React.CSSProperties & {
	'--tokens-rank-column-width': string
	'--tokens-table-min-width': string
}

export function getRankColumnWidth(rows: TokensTableRow[]): number {
	let maxDigits = 1
	for (const row of rows) {
		const digits = String(row.rowNumber).length
		if (digits > maxDigits) maxDigits = digits
	}
	return Math.max(40, 20 + maxDigits * 7)
}

function Dash() {
	return <span className="text-tertiary">-</span>
}

function CurrencyValue({ value }: { value: string | null }) {
	return value === null ? <Dash /> : <span className="tabular-nums">{value}</span>
}

function PercentValue({ value, tone }: { value: string | null; tone: TokensDisplayTone }) {
	if (value === null) return <Dash />
	return <span className={`tabular-nums ${VALUE_TONE_CLASSES[tone]}`}>{value}</span>
}

function ProgressPercentValue({
	value,
	width,
	tone = 'link'
}: {
	value: string | null
	width: string | null
	tone?: 'link' | 'success'
}) {
	if (value === null || width === null) return <Dash />
	const barClassName = tone === 'success' ? 'bg-data-up' : 'bg-brand'

	return (
		<span className="flex min-w-[92px] flex-col items-end gap-1">
			<span className="font-jetbrains text-sm font-semibold tabular-nums">{value}</span>
			<span className="h-1.5 w-20 overflow-hidden rounded-full bg-(--bg-tertiary)">
				<span className={`block h-full rounded-full ${barClassName}`} style={{ width }} />
			</span>
		</span>
	)
}

function TokenCell({ row }: { row: { original: TokensTableRow } }) {
	const { name, symbol, logo, href, id } = row.original
	const label = (
		<span className="min-w-0">
			<span className="block overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap">{name}</span>
			<span className="block label-sm text-secondary">{symbol}</span>
		</span>
	)

	return (
		<span className="relative flex min-w-0 items-center gap-2 pl-5">
			<Bookmark watchlistType="tokens" itemKey={id} readableName={symbol} data-lgonly data-bookmark />
			<TokenLogo src={logo} size={24} alt={`Logo of ${name}`} />
			{href ? (
				<BasicLink href={href} className="min-w-0 text-link hover:underline">
					{label}
				</BasicLink>
			) : (
				label
			)}
		</span>
	)
}

function rightsStatusTone(value: string): RightsTone {
	switch (value) {
		case 'On':
		case 'Active':
		case 'Yes':
			return 'positive'
		case 'Off':
		case 'None':
		case 'No':
			return 'negative'
		case 'Pending':
		case 'Partial':
			return 'warning'
		default:
			return 'neutral'
	}
}

function equityCaptureTone(value: string): RightsTone {
	if (value === 'Yes') return 'negative'
	if (value === 'Partial') return 'warning'
	if (value === 'No') return 'positive'
	return 'neutral'
}

function RightsToneText({ label, tone }: { label: string; tone: RightsTone }) {
	return <span className={`label-sm font-semibold whitespace-nowrap ${RIGHTS_TEXT_TONE_CLASSES[tone]}`}>{label}</span>
}

function RightsChip({ label, tone }: { label: string; tone: RightsTone }) {
	return (
		<span
			className={`inline-flex w-fit shrink-0 items-center rounded-md border px-1.5 py-0.5 label-sm whitespace-nowrap ${RIGHTS_CHIP_TONE_CLASSES[tone]}`}
		>
			{label}
		</span>
	)
}

function RightsChipList({
	items,
	tone,
	wrap = false,
	align = 'start'
}: {
	items: string[]
	tone: RightsTone
	wrap?: boolean
	align?: 'start' | 'end'
}) {
	return (
		<span
			className={`flex min-w-0 items-center gap-1 ${wrap ? 'flex-wrap' : 'flex-nowrap'} ${align === 'end' ? 'w-full justify-end text-right' : ''}`}
		>
			{items.map((item, index) => (
				<RightsChip key={`${item}-${index}`} label={item} tone={tone} />
			))}
		</span>
	)
}

function RightsTokenValue({
	items,
	inactiveLabel,
	inactiveTone
}: {
	items: string[]
	inactiveLabel: string
	inactiveTone?: RightsTone
}) {
	if (items.length === 0) {
		return <RightsToneText label={inactiveLabel} tone={inactiveTone ?? rightsStatusTone(inactiveLabel)} />
	}
	return <RightsChipList items={items} tone="positive" wrap align="end" />
}

function RightsPopover({ rights }: { rights: TokensRightsSummary }) {
	const hasPrimaryValueAccrual = rights.primaryValue !== null || rights.primaryDetails !== null
	const hasStructuralDistribution = rights.buybacks || rights.dividends
	const coreFields: Array<{ label: string; tone: RightsTone; value: React.ReactNode }> = [
		{
			label: 'Governance',
			tone: rights.governance ? 'positive' : 'neutral',
			value: <RightsTokenValue items={rights.governanceTokens} inactiveLabel="N/A" />
		},
		{
			label: 'Treasury',
			tone: rights.treasury ? 'positive' : 'neutral',
			value: <RightsTokenValue items={rights.treasuryTokens} inactiveLabel="N/A" />
		},
		{
			label: 'Revenue',
			tone: rights.revenue ? 'positive' : 'neutral',
			value: <RightsTokenValue items={rights.revenueTokens} inactiveLabel="N/A" />
		},
		{
			label: 'Buybacks',
			tone: hasStructuralDistribution ? 'positive' : 'negative',
			value: (
				<RightsTokenValue
					items={rights.buybackTokens}
					inactiveLabel="None"
					inactiveTone={hasStructuralDistribution ? 'neutral' : 'negative'}
				/>
			)
		},
		{
			label: 'Dividends',
			tone: hasStructuralDistribution ? 'positive' : 'negative',
			value: (
				<RightsTokenValue
					items={rights.dividendTokens}
					inactiveLabel="None"
					inactiveTone={hasStructuralDistribution ? 'neutral' : 'negative'}
				/>
			)
		},
		{
			label: 'Burns',
			tone: rights.burns ? rightsStatusTone(rights.burnsStatus) : 'negative',
			value: rights.burns ? (
				<RightsChip label={rights.burnsStatus} tone={rightsStatusTone(rights.burnsStatus)} />
			) : (
				<RightsToneText label="None" tone="negative" />
			)
		}
	]
	const extraFields = [
		{
			label: 'Fee Switch',
			value: <RightsToneText label={rights.feeSwitchStatus} tone={rightsStatusTone(rights.feeSwitchStatus)} />
		},
		{
			label: 'Equity Rev. Capture',
			value: (
				<RightsToneText label={rights.equityRevenueCapture} tone={equityCaptureTone(rights.equityRevenueCapture)} />
			)
		}
	]

	return (
		<div className="w-[min(24rem,var(--popover-available-width))] whitespace-normal text-primary">
			<div className="flex min-w-0 flex-col gap-2.5">
				<div className="flex flex-wrap items-center gap-1.5">
					<h3 className="text-base leading-tight font-semibold">{rights.protocolName}</h3>
					{rights.identityTokens.length > 0 ? (
						<RightsChipList items={rights.identityTokens} tone="positive" wrap />
					) : null}
				</div>

				{hasPrimaryValueAccrual ? (
					<div className="flex flex-col gap-1 rounded-md border border-green-600/30 bg-green-600/10 p-2">
						<div className="label-sm font-medium tracking-wider text-secondary uppercase">Primary Value Accrual</div>
						{rights.primaryValue !== null ? (
							<div className="text-sm font-semibold text-green-700 dark:text-green-400">{rights.primaryValue}</div>
						) : null}
						{rights.primaryDetails ? (
							<p className="label-sm leading-snug text-secondary">{rights.primaryDetails}</p>
						) : null}
					</div>
				) : null}

				<div className="grid min-w-0 gap-1.5">
					{coreFields.map((field) => (
						<div
							key={field.label}
							className="grid min-w-0 grid-cols-[8rem_minmax(0,1fr)] items-center gap-3 border-b border-subtle pb-1.5 last:border-b-0 last:pb-0"
						>
							<span className="flex min-w-0 items-center gap-1.5 label-sm whitespace-nowrap text-secondary">
								<span className={`size-1.5 shrink-0 rounded-full ${RIGHTS_DOT_TONE_CLASSES[field.tone]}`} />
								{field.label}
							</span>
							<span className="flex min-w-0 items-center justify-end text-right">{field.value}</span>
						</div>
					))}
				</div>

				<div className="grid gap-1.5 border-t border-subtle pt-2">
					{extraFields.map((field) => (
						<div key={field.label} className="grid min-w-0 grid-cols-[8rem_minmax(0,1fr)] items-center gap-3">
							<span className="label-sm whitespace-nowrap text-secondary">{field.label}</span>
							<span className="flex min-w-0 items-center justify-end text-right">{field.value}</span>
						</div>
					))}
				</div>

				{rights.utilityItems.length > 0 || rights.fundraisingLabel || rights.associatedEntities.length > 0 ? (
					<div className="grid gap-2 border-t border-subtle pt-2">
						{rights.utilityItems.length > 0 ? (
							<div className="grid min-w-0 grid-cols-[8rem_minmax(0,1fr)] items-center gap-3">
								<span className="label-sm whitespace-nowrap text-secondary">Utility</span>
								<RightsChipList items={rights.utilityItems} tone="neutral" wrap align="end" />
							</div>
						) : null}
						{rights.fundraisingLabel ? (
							<div className="grid min-w-0 grid-cols-[8rem_minmax(0,1fr)] items-center gap-3">
								<span className="label-sm whitespace-nowrap text-secondary">Fundraising</span>
								<span className="flex min-w-0 items-center justify-end text-right">
									<RightsToneText label={rights.fundraisingLabel} tone="neutral" />
								</span>
							</div>
						) : null}
						{rights.associatedEntities.length > 0 ? (
							<div className="grid min-w-0 grid-cols-[8rem_minmax(0,1fr)] items-center gap-3">
								<span className="label-sm whitespace-nowrap text-secondary">Entities</span>
								<RightsChipList items={rights.associatedEntities} tone="neutral" wrap align="end" />
							</div>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	)
}

function RightsPie({ rights }: { rights: TokensRightsSummary | null }) {
	if (!rights) return <Dash />

	return (
		<Tooltip content={<RightsPopover rights={rights} />} placement="left" data-fullwidth className="!inline-flex w-fit">
			<span
				role="img"
				aria-label="Token rights summary"
				className="inline-block size-7 rounded-full border border-medium"
				style={{ background: rights.pieGradient }}
			/>
		</Tooltip>
	)
}

const baseColumns: ColumnDef<TokensTableRow>[] = [
	columnHelper.accessor((row) => row.rank ?? undefined, {
		id: 'rank',
		header: '#',
		cell: ({ row }) => <span className="label-sm text-secondary tabular-nums">{row.original.rowNumber}</span>,
		meta: {
			headerClassName:
				'sticky left-0 z-20 w-[var(--tokens-rank-column-width)] min-w-[var(--tokens-rank-column-width)] bg-surface !px-1',
			cellClassName: 'sticky left-0 z-10 bg-surface !px-1',
			align: 'end',
			headerHelperText: 'Row number in the current sorted and filtered results'
		}
	}),
	columnHelper.accessor((row) => row.name, {
		id: 'name',
		header: 'Coin',
		cell: ({ row }) => <TokenCell row={row} />,
		meta: {
			headerClassName: 'sticky left-[var(--tokens-rank-column-width)] z-20 w-[184px] min-w-[184px] bg-surface !pl-1',
			cellClassName: 'sticky left-[var(--tokens-rank-column-width)] z-10 bg-surface !pl-1',
			headerHelperText: 'Token name, symbol, and token page link when available'
		}
	}),
	columnHelper.accessor((row) => row.price ?? undefined, {
		id: 'price',
		header: 'Price',
		cell: ({ row }) => <CurrencyValue value={row.original.display.price} />,
		meta: {
			headerClassName: 'w-[110px] min-w-[110px]',
			align: 'end',
			headerHelperText: 'Current token price in USD'
		}
	}),
	columnHelper.accessor((row) => row.priceChange24h ?? undefined, {
		id: 'priceChange24h',
		header: '24H',
		cell: ({ row }) => (
			<PercentValue value={row.original.display.priceChange24h} tone={row.original.display.priceChange24hTone} />
		),
		meta: {
			headerClassName: 'w-[90px] min-w-[90px]',
			align: 'end',
			headerHelperText: 'Token price change over the last 24 hours'
		}
	}),
	columnHelper.accessor((row) => row.priceChange7d ?? undefined, {
		id: 'priceChange7d',
		header: '7D',
		cell: ({ row }) => (
			<PercentValue value={row.original.display.priceChange7d} tone={row.original.display.priceChange7dTone} />
		),
		meta: {
			headerClassName: 'w-[90px] min-w-[90px]',
			align: 'end',
			headerHelperText: 'Token price change over the last 7 days'
		}
	}),
	columnHelper.accessor((row) => row.priceChange30d ?? undefined, {
		id: 'priceChange30d',
		header: '30D',
		cell: ({ row }) => (
			<PercentValue value={row.original.display.priceChange30d} tone={row.original.display.priceChange30dTone} />
		),
		meta: {
			headerClassName: 'w-[90px] min-w-[90px]',
			align: 'end',
			headerHelperText: 'Token price change over the last 30 days'
		}
	}),
	columnHelper.accessor((row) => row.marketCap ?? undefined, {
		id: 'marketCap',
		header: 'MCap',
		cell: ({ row }) => <CurrencyValue value={row.original.display.marketCap} />,
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end',
			headerHelperText: 'Market capitalization from token price and circulating supply'
		}
	}),
	columnHelper.accessor((row) => row.fdv ?? undefined, {
		id: 'fdv',
		header: 'FDV',
		cell: ({ row }) => <CurrencyValue value={row.original.display.fdv} />,
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end',
			headerHelperText: 'Fully diluted valuation from token price and max supply'
		}
	}),
	columnHelper.accessor((row) => row.outstandingFdv ?? undefined, {
		id: 'outstandingFdv',
		header: 'OFDV',
		cell: ({ row }) => <CurrencyValue value={row.original.display.outstandingFdv} />,
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end',
			headerHelperText: 'Outstanding FDV using adjusted unlocked/outstanding supply when available'
		}
	}),
	columnHelper.accessor((row) => row.unlockedPercent ?? undefined, {
		id: 'unlockedPercent',
		header: '% Unlocked',
		cell: ({ row }) => (
			<ProgressPercentValue
				value={row.original.display.unlockedPercent}
				width={row.original.display.unlockedPercentWidth}
			/>
		),
		meta: {
			headerClassName: 'w-[130px] min-w-[130px]',
			align: 'end',
			headerHelperText: 'Estimated share of max supply currently unlocked or outstanding'
		}
	}),
	columnHelper.accessor((row) => row.spotVolume24h ?? undefined, {
		id: 'spotVolume24h',
		header: 'Spot Vol',
		cell: ({ row }) => <CurrencyValue value={row.original.display.spotVolume24h} />,
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end',
			headerHelperText: '24h spot trading volume across tracked markets'
		}
	}),
	columnHelper.accessor((row) => row.perpsVolume24h ?? undefined, {
		id: 'perpsVolume24h',
		header: 'Perps Vol',
		cell: ({ row }) => <CurrencyValue value={row.original.display.perpsVolume24h} />,
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end',
			headerHelperText: '24h perpetual futures trading volume across tracked markets'
		}
	}),
	columnHelper.accessor((row) => row.openInterest24h ?? undefined, {
		id: 'openInterest24h',
		header: 'OI',
		cell: ({ row }) => <CurrencyValue value={row.original.display.openInterest24h} />,
		meta: {
			headerClassName: 'w-[110px] min-w-[110px]',
			align: 'end',
			headerHelperText: 'Open interest across tracked perpetual markets'
		}
	}),
	columnHelper.accessor((row) => row.fees24h ?? undefined, {
		id: 'fees24h',
		header: '24H Fees',
		cell: ({ row }) => <CurrencyValue value={row.original.display.fees24h} />,
		meta: {
			headerClassName: 'w-[110px] min-w-[110px]',
			align: 'end',
			headerHelperText: 'Protocol fees over the last 24 hours when a protocol match exists'
		}
	}),
	columnHelper.accessor((row) => row.revenue24h ?? undefined, {
		id: 'revenue24h',
		header: '24H Rev',
		cell: ({ row }) => <CurrencyValue value={row.original.display.revenue24h} />,
		meta: {
			headerClassName: 'w-[110px] min-w-[110px]',
			align: 'end',
			headerHelperText: 'Protocol revenue over the last 24 hours when a protocol match exists'
		}
	}),
	columnHelper.accessor((row) => row.holdersRevenue24h ?? undefined, {
		id: 'holdersRevenue24h',
		header: '24H Holders Rev',
		cell: ({ row }) => <CurrencyValue value={row.original.display.holdersRevenue24h} />,
		meta: {
			headerClassName: 'w-[150px] min-w-[150px]',
			align: 'end',
			headerHelperText: '24h revenue directed to token holders when tracked'
		}
	}),
	columnHelper.accessor((row) => row.trsPercent ?? undefined, {
		id: 'trsPercent',
		header: 'TRS %',
		cell: ({ row }) => (
			<ProgressPercentValue
				value={row.original.display.trsPercent}
				width={row.original.display.trsPercentWidth}
				tone="success"
			/>
		),
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end',
			headerHelperText: 'Token holder revenue as a percentage of protocol revenue'
		}
	}),
	columnHelper.accessor((row) => row.rights ?? undefined, {
		id: 'rights',
		header: 'Rights',
		cell: ({ getValue }) => <RightsPie rights={getValue() ?? null} />,
		enableSorting: false,
		meta: {
			headerClassName: 'w-[90px] min-w-[90px]',
			align: 'center',
			headerHelperText: 'Compact summary of governance, treasury, revenue, buyback, dividend, and burn rights'
		}
	}),
	columnHelper.accessor((row) => row.unlock30dUsd ?? undefined, {
		id: 'unlock30dUsd',
		header: '30D Unlocks',
		cell: ({ row }) => <CurrencyValue value={row.original.display.unlock30dUsd} />,
		meta: {
			headerClassName: 'w-[130px] min-w-[130px]',
			align: 'end',
			headerHelperText: 'Estimated value of unlock events over the next 30 days'
		}
	}),
	columnHelper.accessor((row) => row.upcomingUnlockUsd ?? undefined, {
		id: 'upcomingUnlockUsd',
		header: 'Next Unlock',
		cell: ({ row }) => <CurrencyValue value={row.original.display.upcomingUnlockUsd} />,
		meta: {
			headerClassName: 'w-[130px] min-w-[130px]',
			align: 'end',
			headerHelperText: 'Estimated value of the next known unlock event'
		}
	})
]

const expanderColumn: ColumnDef<TokensTableRow> = columnHelper.display({
	id: 'expander',
	header: 'Markets',
	enableSorting: false,
	cell: ({ row }) => {
		const isExpanded = row.getIsExpanded()
		return (
			<Button type="button" onClick={row.getToggleExpandedHandler()} aria-expanded={isExpanded}>
				Markets
				<Icon
					name="chevron-down"
					height={12}
					width={12}
					className={`text-tertiary transition-transform duration-100 ${isExpanded ? 'rotate-180' : ''}`}
				/>
			</Button>
		)
	},
	meta: {
		headerClassName: 'w-[104px] min-w-[104px]',
		headerHelperText: 'Show the exchanges and trading pairs this token is available on'
	}
})

export function buildTokensColumns({ expandable = false }: { expandable?: boolean } = {}): ColumnDef<TokensTableRow>[] {
	if (!expandable) return baseColumns
	const cols = baseColumns.slice()
	const nameIndex = cols.findIndex((col) => col.id === 'name')
	const insertAt = nameIndex >= 0 ? nameIndex + 1 : cols.length
	cols.splice(insertAt, 0, expanderColumn)
	return cols
}

function TokensStatsChange({ value, tone }: { value: string | null; tone: TokensDisplayTone }) {
	if (value === null) return null
	return <span className={`label-md tabular-nums ${VALUE_TONE_CLASSES[tone]}`}>{value}</span>
}

function TokensStats({ stats }: { stats: TokensPageStatsDisplay }) {
	const items = [
		{
			label: 'MCap',
			value: stats.totalMarketCap,
			change: stats.marketCapWeightedChange24h,
			changeTone: stats.marketCapWeightedChange24hTone
		},
		{ label: 'Spot Vol', value: stats.spotVolume24h },
		{ label: 'Perps Vol', value: stats.perpsVolume24h },
		{ label: 'OI', value: stats.openInterest24h },
		{ label: '30D Unlocks', value: stats.unlock30dUsd },
		{ label: 'Next Unlocks', value: stats.upcomingUnlockUsd }
	] as const

	return (
		<Card as="dl" padding="sm" className="flex w-full flex-wrap items-center gap-x-5 gap-y-1.5">
			{items.map((item) => (
				<div key={item.label} className="flex items-baseline gap-1.5">
					<dt className="body-sm text-secondary">{item.label}</dt>
					<dd className="label-md tabular-nums">{item.value}</dd>
					{'change' in item && item.change != null ? (
						<dd>
							<TokensStatsChange value={item.change} tone={item.changeTone} />
						</dd>
					) : null}
				</div>
			))}
		</Card>
	)
}

function TokensControls({ search, updateSearch }: { search: string; updateSearch: (search: string) => void }) {
	const searchInputRef = React.useRef<HTMLInputElement>(null)
	const debouncedUpdateSearch = useDebouncedCallback(updateSearch, 300)

	React.useEffect(() => {
		const input = searchInputRef.current
		if (input && input.value !== search) input.value = search
	}, [search])

	const handleSearchInput = React.useCallback(
		(event: React.FormEvent<HTMLInputElement>) => {
			debouncedUpdateSearch(event.currentTarget.value.trim())
		},
		[debouncedUpdateSearch]
	)
	const handleSubmit = React.useCallback(
		(event: React.FormEvent<HTMLFormElement>) => {
			event.preventDefault()
			const value = new FormData(event.currentTarget).get('search')
			debouncedUpdateSearch.cancel()
			updateSearch(typeof value === 'string' ? value.trim() : '')
		},
		[debouncedUpdateSearch, updateSearch]
	)

	return (
		<div className="flex justify-end">
			<form onSubmit={handleSubmit} className="w-full sm:max-w-sm">
				<label className="relative block min-w-0">
					<span className="sr-only">Search tokens</span>
					<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
					<input
						ref={searchInputRef}
						name="search"
						defaultValue={search}
						onInput={handleSearchInput}
						placeholder="Search tokens..."
						className={searchFieldInputStyles}
					/>
				</label>
			</form>
		</div>
	)
}

export default function TokensPage({ initialData }: TokensPageProps) {
	const serverTable = useTokensServerTable(initialData)
	const rankColumnWidth = getRankColumnWidth(serverTable.rows)
	const tableStyle: TokensTableStyle = {
		'--tokens-rank-column-width': `${rankColumnWidth}px`,
		'--tokens-table-min-width': `${TOKENS_TABLE_WIDTH_EXCLUDING_RANK + rankColumnWidth}px`
	}
	const table = useReactTable({
		data: serverTable.rows,
		columns: buildTokensColumns(),
		state: {
			pagination: serverTable.pagination,
			sorting: serverTable.sorting
		},
		enableSortingRemoval: false,
		manualPagination: true,
		manualSorting: true,
		rowCount: serverTable.total,
		onPaginationChange: serverTable.onPaginationChange,
		onSortingChange: serverTable.onSortingChange,
		getCoreRowModel: getCoreRowModel()
	})

	return (
		<div className="flex flex-col gap-2">
			<TokensStats stats={serverTable.data.statsDisplay} />
			<TokensControls search={serverTable.pageQuery.search} updateSearch={serverTable.updateSearch} />
			<PaginatedTable
				table={table}
				pageSizeOptions={PAGE_SIZE_OPTIONS}
				style={tableStyle}
				tableClassName="min-w-[var(--tokens-table-min-width)]"
				interactionDisabled={serverTable.rowsQuery.isFetching}
			/>
		</div>
	)
}
