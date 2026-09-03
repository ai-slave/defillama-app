import {
	createColumnHelper,
	functionalUpdate,
	getCoreRowModel,
	useReactTable,
	type ColumnDef,
	type VisibilityState
} from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { Bookmark } from '~/components/Bookmark'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { BasicLink } from '~/components/Link'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { PaginatedTable } from '~/components/Table/PaginatedTable'
import { TokenLogo } from '~/components/TokenLogo'
import { TokenRightsPieChart } from '~/containers/TokenRights/TokenRightsPieChart'
import { useDebouncedCallback } from '~/hooks/useDebounce'
import { Button } from '~/ui/Button'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { InlineStatStrip, type InlineStatStripItem } from '~/ui/SummaryStats'
import { TableToolbar } from '~/ui/Toolbar'
import { pushShallowQuery } from '~/utils/routerQuery'
import { NAME_COLUMN_WIDTH, TOKENS_HIDEABLE_COLUMN_SPECS, TOKENS_HIDEABLE_COLUMNS_WIDTH } from './columnSpecs'
import { prepareTokensCsv } from './csv'
import {
	buildTokensFiltersQueryUpdate,
	getTokensFiltersDefaultSorting,
	parseTokensFiltersFromQuery,
	shouldApplyTokensFilterSorting,
	type TokensActiveFilter
} from './filters'
import { TokensChartsSection } from './TokensChartsSection'
import { TokensActiveFilterPills, TokensFiltersDialog } from './TokensFiltersDialog'
import type {
	TokensDisplayTone,
	TokensFilterOption,
	TokensPageProps,
	TokensPageStatsDisplay,
	TokensRightsSummary,
	TokensTableRow
} from './types'
import { useTokensServerTable } from './useTokensServerTable'
import { resolveTokenFilterValues } from './utils'

const PAGE_SIZE_OPTIONS = [50, 100, 200] as const
export const TOKENS_TABLE_WIDTH_EXCLUDING_RANK = NAME_COLUMN_WIDTH + TOKENS_HIDEABLE_COLUMNS_WIDTH
// Width of the optional "Markets" expander column (added only in the expandable/watchlist variant).
export const TOKENS_MARKETS_EXPANDER_COLUMN_WIDTH = 104
const columnHelper = createColumnHelper<TokensTableRow>()

type RightsTone = 'positive' | 'negative' | 'warning' | 'neutral'

const RIGHTS_CHIP_TONE_CLASSES: Record<RightsTone, string> = {
	positive: 'border-success/30 bg-success/10 text-success',
	negative: 'border-red-600/30 bg-red-600/10 text-error dark:text-error',
	warning: 'border-amber-600/30 bg-amber-600/10 text-warning',
	neutral: 'border-medium bg-surface text-secondary'
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
	return value === null ? <Dash /> : <span className="whitespace-nowrap">{value}</span>
}

function PercentValue({ value, tone }: { value: string | null; tone: TokensDisplayTone }) {
	if (value === null) return <Dash />
	return <span className={VALUE_TONE_CLASSES[tone]}>{value}</span>
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
			<span className="text-sm font-semibold">{value}</span>
			<span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-elevated-2">
				<span className={`block h-full rounded-full ${barClassName}`} style={{ width }} />
			</span>
		</span>
	)
}

function TokenCell({ row }: { row: { original: TokensTableRow } }) {
	const { name, symbol, logo, href, id } = row.original
	const label = (
		<span className="min-w-0">
			<span className="block truncate text-sm font-medium">{name}</span>
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

function RightsChip({ label, tone }: { label: string; tone: RightsTone }) {
	return (
		<span
			className={`inline-flex w-fit shrink-0 items-center rounded-md border px-1.5 py-0.5 label-sm whitespace-nowrap ${RIGHTS_CHIP_TONE_CLASSES[tone]}`}
		>
			{label}
		</span>
	)
}

function RightsChipList({ items, tone, wrap = false }: { items: string[]; tone: RightsTone; wrap?: boolean }) {
	return (
		<span className={`flex min-w-0 items-center gap-1 ${wrap ? 'flex-wrap' : 'flex-nowrap'}`}>
			{items.map((item, index) => (
				<RightsChip key={`${item}-${index}`} label={item} tone={tone} />
			))}
		</span>
	)
}

function getRightsPieSegments(rights: TokensRightsSummary): Parameters<typeof TokenRightsPieChart>[0]['segments'] {
	const hasValueAccrual = rights.buybacks || rights.dividends
	return [
		{ label: 'Treasury', tone: rights.treasury ? 'positive' : 'negative' },
		{ label: 'Revenue', tone: rights.revenue ? 'positive' : 'negative' },
		{ label: 'Burns', tone: rights.burns ? 'positive' : 'negative' },
		{ label: 'Equity', tone: rights.equityTone },
		{ label: 'Value Accrual', tone: hasValueAccrual ? 'positive' : 'negative' },
		{ label: 'Governance', tone: rights.governance ? 'positive' : 'negative' }
	]
}

function RightsPopover({ rights, fullRightsHref }: { rights: TokensRightsSummary; fullRightsHref: string | null }) {
	const hasPrimaryValueAccrual = rights.primaryValue !== null || rights.primaryDetails !== null
	const pieSegments = getRightsPieSegments(rights)
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
					<div className="flex flex-col gap-1 rounded-md border border-success/30 bg-success/10 p-2">
						<div className="label-sm tracking-wider text-secondary uppercase">Primary Value Accrual</div>
						{rights.primaryValue !== null ? (
							<div className="text-sm font-semibold text-success">{rights.primaryValue}</div>
						) : null}
						{rights.primaryDetails ? <p className="label-sm text-secondary">{rights.primaryDetails}</p> : null}
					</div>
				) : null}

				<div className="flex justify-center">
					<TokenRightsPieChart segments={pieSegments} />
				</div>

				{rights.utilityItems.length > 0 ? (
					<div className="flex flex-col items-center gap-1.5">
						<div className="label-sm tracking-wider text-secondary uppercase">Utility</div>
						<RightsChipList items={rights.utilityItems} tone="neutral" wrap />
					</div>
				) : null}

				{fullRightsHref ? (
					<div className="flex justify-end border-t border-subtle pt-2">
						<BasicLink
							href={fullRightsHref}
							className="inline-flex items-center gap-1 label-sm text-link hover:underline"
						>
							Full token rights
							<Icon name="external-link" className="size-3.5" />
						</BasicLink>
					</div>
				) : null}
			</div>
		</div>
	)
}

function RightsPie({ rights, fullRightsHref }: { rights: TokensRightsSummary | null; fullRightsHref: string | null }) {
	if (!rights) return <Dash />

	return (
		<Hovercard
			content={<RightsPopover rights={rights} fullRightsHref={fullRightsHref} />}
			placement="left"
			className="inline-flex! w-fit"
		>
			<TokenRightsPieChart segments={getRightsPieSegments(rights)} showLabels={false} className="size-7 shrink-0" />
		</Hovercard>
	)
}

const baseColumns: ColumnDef<TokensTableRow>[] = [
	columnHelper.accessor((row) => row.rank ?? undefined, {
		id: 'rank',
		header: '#',
		cell: ({ row }) => <span className="text-secondary">{row.original.rowNumber}</span>,
		enableHiding: false,
		meta: {
			headerClassName:
				'sticky left-0 z-20 w-(--tokens-rank-column-width) min-w-(--tokens-rank-column-width) bg-surface px-1!',
			cellClassName: 'sticky left-0 z-10 bg-surface px-1!',
			align: 'center',
			headerHelperText: 'Row number in the current sorted and filtered results'
		}
	}),
	columnHelper.accessor((row) => row.name, {
		id: 'name',
		header: 'Coin',
		cell: ({ row }) => <TokenCell row={row} />,
		enableHiding: false,
		meta: {
			headerClassName: 'sticky left-(--tokens-rank-column-width) z-20 w-[184px] min-w-[184px] bg-surface pl-1!',
			cellClassName: 'sticky left-(--tokens-rank-column-width) z-10 bg-surface pl-1!',
			headerHelperText: 'Token name, symbol, and token page link when available'
		}
	}),
	columnHelper.accessor((row) => row.price ?? undefined, {
		id: 'price',
		header: 'Price',
		cell: ({ row }) => <CurrencyValue value={row.original.display.price} />,
		meta: {
			headerClassName: 'w-[140px] min-w-[140px]',
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
		cell: ({ getValue, row }) => (
			<RightsPie rights={getValue() ?? null} fullRightsHref={row.original.tokenRightsHref} />
		),
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
			headerHelperText: 'Estimated value of unlock events over the previous 30 days'
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
			<Button type="button" size="sm" onClick={row.getToggleExpandedHandler()} aria-expanded={isExpanded}>
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

function TokensStats({ stats }: { stats: TokensPageStatsDisplay }) {
	const items: InlineStatStripItem[] = [
		{
			label: 'MCap',
			value: stats.totalMarketCap,
			change: stats.marketCapWeightedChange24h,
			changeClassName: VALUE_TONE_CLASSES[stats.marketCapWeightedChange24hTone]
		},
		{ label: 'Spot Vol', value: stats.spotVolume24h },
		{ label: 'Perps Vol', value: stats.perpsVolume24h },
		{ label: 'OI', value: stats.openInterest24h },
		{ label: '30D Unlocks', value: stats.unlock30dUsd },
		{ label: 'Next Unlocks', value: stats.upcomingUnlockUsd }
	]

	return <InlineStatStrip items={items} />
}

function TokensControls({
	search,
	updateSearch,
	filters,
	selectedChains,
	selectedCategories,
	chainOptions,
	categoryOptions,
	onFiltersChange,
	selectedColumns,
	setSelectedColumns,
	prepareCsv
}: {
	search: string
	updateSearch: (search: string) => void
	filters: TokensActiveFilter[]
	selectedChains: string[]
	selectedCategories: string[]
	chainOptions: TokensFilterOption[]
	categoryOptions: TokensFilterOption[]
	onFiltersChange: (filters: TokensActiveFilter[]) => void
	selectedColumns: string[]
	setSelectedColumns: (updater: string[] | ((old: string[]) => string[])) => void
	prepareCsv: () => Promise<{ filename: string; rows: Array<Array<string | number>> }>
}) {
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
	const chainSelectOptions = React.useMemo(
		() => chainOptions.map((option) => ({ key: option.id, name: option.label })),
		[chainOptions]
	)
	const categorySelectOptions = React.useMemo(
		() => categoryOptions.map((option) => ({ key: option.id, name: option.label })),
		[categoryOptions]
	)

	return (
		<TableToolbar>
			<h2 className="label-md">Token Rankings</h2>
			<form onSubmit={handleSubmit} className={`${searchFieldInlineWrapperStyles} ml-auto`}>
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
			<SelectWithCombobox
				allValues={chainSelectOptions}
				selectedValues={selectedChains}
				includeQueryKey="chains"
				excludeQueryKey="excludeChains"
				resetPageOnQueryChange
				label="Chains"
				labelType="smol"
				variant="filter-responsive"
				size="md"
				searchPlaceholder="Search chains..."
			/>
			<SelectWithCombobox
				allValues={categorySelectOptions}
				selectedValues={selectedCategories}
				includeQueryKey="categories"
				excludeQueryKey="excludeCategories"
				resetPageOnQueryChange
				label="Categories"
				labelType="smol"
				variant="filter-responsive"
				size="md"
				visibleOptionLimit={null}
				searchPlaceholder="Search categories..."
			/>
			<TokensFiltersDialog filters={filters} onFiltersChange={onFiltersChange} />
			<SelectWithCombobox
				allValues={COLUMN_PICKER_OPTIONS}
				selectedValues={selectedColumns}
				setSelectedValues={setSelectedColumns}
				nestedMenu={false}
				label="Columns"
				labelType="smol"
				variant="filter-responsive"
				size="md"
			/>
			<CSVDownloadButton prepareCsv={prepareCsv} smol size="md" />
		</TableToolbar>
	)
}

const TOKENS_COLUMN_VISIBILITY_STORAGE_KEY = 'tokens-table-column-visibility-v2'
const HIDEABLE_COLUMNS = TOKENS_HIDEABLE_COLUMN_SPECS
const COLUMN_PICKER_OPTIONS = HIDEABLE_COLUMNS.map((column) => ({ key: column.id, name: column.header }))

const DEFAULT_VISIBLE_COLUMN_IDS = new Set([
	'price',
	'priceChange24h',
	'priceChange7d',
	'priceChange30d',
	'marketCap',
	'fdv',
	'spotVolume24h',
	'revenue24h'
])

const DEFAULT_COLUMN_VISIBILITY: VisibilityState = Object.fromEntries(
	HIDEABLE_COLUMNS.map((column) => [column.id, DEFAULT_VISIBLE_COLUMN_IDS.has(column.id)])
)

function readStoredColumnVisibility(): VisibilityState | null {
	try {
		const stored = window.localStorage.getItem(TOKENS_COLUMN_VISIBILITY_STORAGE_KEY)
		const parsed = stored ? JSON.parse(stored) : null
		return parsed && typeof parsed === 'object' ? parsed : null
	} catch {
		return null
	}
}

export default function TokensPage({ initialData, initialChartData }: TokensPageProps) {
	const router = useRouter()
	const serverTable = useTokensServerTable(initialData)
	const filters = React.useMemo(() => parseTokensFiltersFromQuery(router.query), [router.query])
	const chainOptionIds = React.useMemo(
		() => serverTable.data.chainOptions.map((option) => option.id),
		[serverTable.data.chainOptions]
	)
	const categoryOptionIds = React.useMemo(
		() => serverTable.data.categoryOptions.map((option) => option.id),
		[serverTable.data.categoryOptions]
	)
	const selectedChains = React.useMemo(
		() => resolveTokenFilterValues(serverTable.pageQuery.chains, serverTable.pageQuery.excludeChains, chainOptionIds),
		[chainOptionIds, serverTable.pageQuery.chains, serverTable.pageQuery.excludeChains]
	)
	const selectedCategories = React.useMemo(
		() =>
			resolveTokenFilterValues(
				serverTable.pageQuery.categories,
				serverTable.pageQuery.excludeCategories,
				categoryOptionIds
			),
		[categoryOptionIds, serverTable.pageQuery.categories, serverTable.pageQuery.excludeCategories]
	)
	const pendingFiltersRef = React.useRef<TokensActiveFilter[] | null>(null)
	React.useEffect(() => {
		pendingFiltersRef.current = null
	}, [router.query])
	const currentSorting = serverTable.sorting[0]
	const applyFilters = React.useCallback(
		(nextFilters: TokensActiveFilter[]) => {
			const previousFilters = pendingFiltersRef.current ?? filters
			const update = buildTokensFiltersQueryUpdate(nextFilters)
			if (shouldApplyTokensFilterSorting(currentSorting, previousFilters)) {
				const nextSorting = getTokensFiltersDefaultSorting(nextFilters)
				update.sortBy =
					nextSorting && !(nextSorting.id === 'marketCap' && nextSorting.desc) ? nextSorting.id : undefined
				update.sortDesc = nextSorting && !nextSorting.desc ? 'false' : undefined
			}
			pendingFiltersRef.current = nextFilters
			void pushShallowQuery(router, update)
		},
		[currentSorting, filters, router]
	)
	const removeFilter = React.useCallback(
		(id: TokensActiveFilter['id']) => {
			const baseFilters = pendingFiltersRef.current ?? filters
			applyFilters(baseFilters.filter((filter) => filter.id !== id))
		},
		[applyFilters, filters]
	)
	const rankColumnWidth = getRankColumnWidth(serverTable.rows)
	const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(DEFAULT_COLUMN_VISIBILITY)
	const effectiveColumnVisibility = React.useMemo(() => {
		const next = { ...columnVisibility }
		for (const filter of filters) {
			if (filter.id !== 'rank') next[filter.id] = true
		}
		return next
	}, [columnVisibility, filters])
	const visibleColumnsWidth = HIDEABLE_COLUMNS.reduce(
		(sum, column) => (effectiveColumnVisibility[column.id] === false ? sum : sum + column.width),
		rankColumnWidth + NAME_COLUMN_WIDTH
	)
	const tableStyle: TokensTableStyle = {
		'--tokens-rank-column-width': `${rankColumnWidth}px`,
		'--tokens-table-min-width': `${visibleColumnsWidth}px`
	}
	React.useEffect(() => {
		const stored = readStoredColumnVisibility()
		if (stored) setColumnVisibility(stored)
	}, [])
	const handleColumnVisibilityChange = React.useCallback(
		(updater: VisibilityState | ((old: VisibilityState) => VisibilityState)) => {
			setColumnVisibility((old) => {
				const next = functionalUpdate(updater, old)
				try {
					window.localStorage.setItem(TOKENS_COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(next))
				} catch {}
				return next
			})
		},
		[]
	)
	const table = useReactTable({
		data: serverTable.rows,
		columns: buildTokensColumns(),
		state: {
			pagination: serverTable.pagination,
			sorting: serverTable.sorting,
			columnVisibility: effectiveColumnVisibility
		},
		enableSortingRemoval: false,
		manualPagination: true,
		manualSorting: true,
		rowCount: serverTable.total,
		onPaginationChange: serverTable.onPaginationChange,
		onSortingChange: serverTable.onSortingChange,
		onColumnVisibilityChange: handleColumnVisibilityChange,
		getCoreRowModel: getCoreRowModel()
	})
	const selectedColumns = HIDEABLE_COLUMNS.filter((column) => columnVisibility[column.id] !== false).map(
		(column) => column.id
	)
	const setSelectedColumns = React.useCallback(
		(updater: string[] | ((old: string[]) => string[])) => {
			handleColumnVisibilityChange((old) => {
				const current = HIDEABLE_COLUMNS.filter((column) => old[column.id] !== false).map((column) => column.id)
				const next = typeof updater === 'function' ? updater(current) : updater
				const visibility: VisibilityState = { ...old }
				for (const column of HIDEABLE_COLUMNS) {
					visibility[column.id] = next.includes(column.id)
				}
				return visibility
			})
		},
		[handleColumnVisibilityChange]
	)
	const prepareCsv = React.useCallback(
		() =>
			prepareTokensCsv({
				query: serverTable.query,
				sorting: serverTable.sorting,
				hiddenColumnIds: new Set(
					HIDEABLE_COLUMNS.filter((c) => effectiveColumnVisibility[c.id] === false).map((c) => c.id)
				)
			}),
		[effectiveColumnVisibility, serverTable.query, serverTable.sorting]
	)

	return (
		<div className="flex flex-col gap-2">
			<TokensStats stats={serverTable.data.statsDisplay} />
			<TokensChartsSection data={initialChartData} />
			<Panel padding="none">
				<TokensControls
					search={serverTable.pageQuery.search}
					updateSearch={serverTable.updateSearch}
					filters={filters}
					selectedChains={selectedChains}
					selectedCategories={selectedCategories}
					chainOptions={serverTable.data.chainOptions}
					categoryOptions={serverTable.data.categoryOptions}
					onFiltersChange={applyFilters}
					selectedColumns={selectedColumns}
					setSelectedColumns={setSelectedColumns}
					prepareCsv={prepareCsv}
				/>
				{filters.length > 0 ? (
					<div className="px-2 pb-2">
						<TokensActiveFilterPills filters={filters} onRemove={removeFilter} />
					</div>
				) : null}
				<PaginatedTable
					table={table}
					pageSizeOptions={PAGE_SIZE_OPTIONS}
					style={tableStyle}
					tableClassName="min-w-(--tokens-table-min-width)"
					stickyHeader
					interactionDisabled={serverTable.rowsQuery.isFetching}
					shell="none"
				/>
			</Panel>
		</div>
	)
}
