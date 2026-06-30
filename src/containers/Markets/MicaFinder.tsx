import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { Checkbox } from '~/components/Checkbox'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { Tooltip } from '~/components/Tooltip'
import { abbreviateNumber, formatPercentage } from '~/utils'
import { getQueryValue, isTruthyQueryParam, pushShallowQuery, toNonEmptyArrayParam } from '~/utils/routerQuery'
import type { ExchangeMetadataEuStatus, ExchangeMetadataListEntry } from './api.types'

// Keyed loosely (Record<string>) so an unknown status from the untyped feed
// falls back to neutral styling instead of an `undefined` class token.
const EU_STATUS_CLASS: Record<string, string> = {
	available: 'border-(--success) text-(--success)',
	leaving: 'border-(--warning) text-(--warning)',
	restricted: 'border-(--warning) text-(--warning)',
	unavailable: 'border-(--error) text-(--error)'
}
const EU_STATUS_NEUTRAL = 'border-(--cards-border) text-(--text-label)'

function EuStatusBadge({ status }: { status: ExchangeMetadataEuStatus | null | undefined }) {
	if (!status) return <span className="text-(--text-disabled)">–</span>
	return (
		<span
			className={`rounded border px-1.5 py-0.5 text-[10px] tracking-wider uppercase ${EU_STATUS_CLASS[status] ?? EU_STATUS_NEUTRAL}`}
		>
			{status}
		</span>
	)
}

function Pills({ items }: { items: string[] }) {
	if (!items?.length) return <span className="text-(--text-disabled)">–</span>
	return (
		<span className="flex flex-wrap gap-1">
			{items.map((it) => (
				<span key={it} className="rounded border border-(--cards-border) px-1.5 py-0.5 text-[10px] text-(--text-label)">
					{it}
				</span>
			))}
		</span>
	)
}

// Single link per row → the exchange site (our referral when we have one, else
// the plain website). Opens in a new tab.
function ExchangeNameCell({ row }: { row: ExchangeMetadataListEntry }) {
	const outbound = row.ref_link || row.website
	if (!outbound) return <span className="text-sm font-medium text-(--text-primary)">{row.display_name}</span>
	return (
		<a
			href={outbound}
			target="_blank"
			rel="noopener noreferrer"
			className="text-sm font-medium text-(--link-text) hover:underline"
		>
			{row.display_name}
		</a>
	)
}

// Reserves (total) with a tooltip for clean reserves + own-token concentration;
// the value goes amber when ≥50% of reserves sit in the venue's own token.
function ReservesCell({ row }: { row: ExchangeMetadataListEntry }) {
	if (row.reserves_usd == null) return <span className="text-(--text-disabled)">–</span>
	const ownPct = row.own_token_pct
	const high = ownPct != null && ownPct >= 0.5
	const tip = [
		row.clean_reserves_usd != null
			? `Clean reserves (excl. own token): ${abbreviateNumber(row.clean_reserves_usd, 2, '$')}`
			: null,
		ownPct != null ? `${Math.round(ownPct * 100)}% held in own token` : null
	]
		.filter(Boolean)
		.join(' · ')
	const formatted = abbreviateNumber(row.reserves_usd, 2, '$')
	const value = high ? <span className="text-(--warning)">{formatted}</span> : formatted
	return (
		<span className="inline-flex items-center justify-end gap-1">
			{tip ? <Tooltip content={tip}>{value}</Tooltip> : value}
			{row.reserves_source_url ? (
				<Tooltip content="Verify reserves at the source">
					<a
						href={row.reserves_source_url}
						target="_blank"
						rel="noopener noreferrer"
						className="text-[10px] text-(--text-disabled) hover:text-(--link-text)"
						aria-label="Verify reserves source"
					>
						?
					</a>
				</Tooltip>
			) : null}
		</span>
	)
}

// ---------------------------------------------------------------------------
// Columns — widths per src/components/Table/COLUMN_WIDTHS.md
// (24px px-3 padding + content + 14px sort affordance on sortable columns).
// Sortable columns return a sortable primitive from accessorFn, with `?? undefined`
// so missing values sort last; non-sortable columns set enableSorting: false.
// ---------------------------------------------------------------------------
const columnHelper = createColumnHelper<ExchangeMetadataListEntry>()

const columns: ColumnDef<ExchangeMetadataListEntry, any>[] = [
	columnHelper.accessor('display_name', {
		id: 'display_name',
		header: 'Exchange',
		enableSorting: false,
		cell: ({ row }) => <ExchangeNameCell row={row.original} />,
		meta: { headerClassName: 'w-[190px] min-w-[190px]' }
	}),
	columnHelper.accessor((row) => (row.mica_licensed ? (row.mica_member_state ?? 'Yes') : undefined), {
		id: 'mica',
		header: 'MiCA',
		cell: ({ row }) =>
			row.original.mica_licensed ? (
				<span className="text-sm">
					<span className="text-(--success)">✓</span>
					{row.original.mica_member_state ? ` ${row.original.mica_member_state}` : ''}
					{row.original.mica_status === 'in-progress' ? (
						<span className="text-[10px] text-(--warning)"> (pending)</span>
					) : null}
				</span>
			) : (
				<span className="text-(--text-disabled)">–</span>
			),
		meta: {
			headerClassName: 'w-[140px] min-w-[140px]',
			headerHelperText: 'MiCA-licensed (and the authorizing member state)'
		}
	}),
	columnHelper.accessor((row) => row.eu_status ?? undefined, {
		id: 'eu_status',
		header: 'EU status',
		cell: ({ getValue }) => <EuStatusBadge status={getValue()} />,
		meta: {
			headerClassName: 'w-[128px] min-w-[128px]',
			headerHelperText: 'Whether EU/EEA users can actually use it today'
		}
	}),
	columnHelper.accessor((row) => row.reserves_usd ?? undefined, {
		id: 'reserves_usd',
		header: 'Reserves',
		cell: ({ row }) => <ReservesCell row={row.original} />,
		meta: {
			headerClassName: 'w-[104px] min-w-[104px]',
			align: 'end' as const,
			headerHelperText: 'DefiLlama proof-of-reserves, when tracked. Hover for clean reserves (excl. own token).'
		}
	}),
	columnHelper.accessor((row) => row.volume_24h_usd ?? undefined, {
		id: 'volume_24h',
		header: '24h Volume',
		cell: ({ getValue }) => abbreviateNumber(getValue(), 2, '$') ?? '–',
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end' as const,
			headerHelperText: 'Reported 24h trading volume (tracked venues only).'
		}
	}),
	columnHelper.accessor((row) => row.inflows_24h_usd ?? undefined, {
		id: 'inflows_24h',
		header: 'Net inflows',
		cell: ({ getValue }) => abbreviateNumber(getValue(), 2, '$') ?? '–',
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end' as const,
			headerHelperText: 'Net reserve inflows over 24h (tracked venues only).'
		}
	}),
	columnHelper.accessor('products', {
		id: 'products',
		header: 'Products',
		enableSorting: false,
		cell: ({ getValue }) => <Pills items={getValue() ?? []} />,
		meta: { headerClassName: 'w-[200px] min-w-[200px]' }
	}),
	columnHelper.accessor((row) => (row.kyc_required == null ? undefined : row.kyc_required ? 1 : 0), {
		id: 'kyc',
		header: 'KYC',
		cell: ({ row }) =>
			row.original.kyc_required == null ? (
				<span className="text-(--text-disabled)">–</span>
			) : row.original.kyc_required ? (
				<span className="text-sm">Required</span>
			) : (
				<span className="text-(--success)">Not required</span>
			),
		meta: { headerClassName: 'w-[120px] min-w-[120px]' }
	}),
	columnHelper.accessor((row) => row.spot_fee.maker ?? undefined, {
		id: 'spot_maker',
		header: 'Spot maker',
		cell: ({ getValue }) => {
			const fee = getValue()
			return fee == null ? '–' : `${formatPercentage(fee * 100)}%`
		},
		meta: {
			headerClassName: 'w-[115px] min-w-[115px]',
			align: 'end' as const,
			headerHelperText: 'Regular-tier spot maker fee (resting/limit orders).'
		}
	}),
	columnHelper.accessor((row) => row.spot_fee.taker ?? undefined, {
		id: 'spot_taker',
		header: 'Spot taker',
		cell: ({ getValue }) => {
			const fee = getValue()
			return fee == null ? '–' : `${formatPercentage(fee * 100)}%`
		},
		meta: {
			headerClassName: 'w-[108px] min-w-[108px]',
			align: 'end' as const,
			headerHelperText: 'Regular-tier spot taker fee (market orders). Sort to find the cheapest.'
		}
	}),
	columnHelper.accessor((row) => row.perp_fee.maker ?? undefined, {
		id: 'perp_maker',
		header: 'Perp maker',
		cell: ({ getValue }) => {
			const fee = getValue()
			return fee == null ? '–' : `${formatPercentage(fee * 100)}%`
		},
		meta: {
			headerClassName: 'w-[115px] min-w-[115px]',
			align: 'end' as const,
			headerHelperText: 'Regular-tier perpetuals maker fee (resting/limit orders).'
		}
	}),
	columnHelper.accessor((row) => row.perp_fee.taker ?? undefined, {
		id: 'perp_taker',
		header: 'Perp taker',
		cell: ({ getValue }) => {
			const fee = getValue()
			return fee == null ? '–' : `${formatPercentage(fee * 100)}%`
		},
		meta: {
			headerClassName: 'w-[108px] min-w-[108px]',
			align: 'end' as const,
			headerHelperText: 'Regular-tier perpetuals taker fee (market orders).'
		}
	}),
	columnHelper.accessor((row) => row.fee_token?.symbol ?? undefined, {
		id: 'fee_token',
		header: 'Fee token',
		enableSorting: false,
		cell: ({ row }) => {
			const ft = row.original.fee_token
			if (!ft) return <span className="text-(--text-disabled)">–</span>
			const symbol = ft.symbol.toUpperCase()
			return (
				<Tooltip
					content={
						ft.discount_pct
							? `Pay trading fees in ${symbol} for a ${ft.discount_pct}% fee discount`
							: `Native fee token: ${symbol}`
					}
				>
					<span className="text-sm uppercase">
						{symbol}
						{ft.discount_pct ? <span className="text-[10px] text-(--success)"> −{ft.discount_pct}%</span> : null}
					</span>
				</Tooltip>
			)
		},
		meta: {
			headerClassName: 'w-[100px] min-w-[100px]',
			headerHelperText: 'Native token that earns a trading-fee discount when used to pay fees.'
		}
	}),
	columnHelper.accessor((row) => row.last_verified ?? undefined, {
		id: 'last_verified',
		header: 'Verified',
		cell: ({ getValue }) => getValue() || <span className="text-(--text-disabled)">–</span>,
		meta: { headerClassName: 'w-[92px] min-w-[92px]', align: 'end' as const }
	})
]

// ---------------------------------------------------------------------------
// Product filter — keys match the feed's segment availability list
// ---------------------------------------------------------------------------
const PRODUCT_FILTERS: { key: string; label: string }[] = [
	{ key: 'spot', label: 'Spot' },
	{ key: 'margin', label: 'Margin' },
	{ key: 'perp', label: 'Perp' },
	{ key: 'futures', label: 'Futures' },
	{ key: 'options', label: 'Options' }
]

const PRODUCT_KEYS = new Set(PRODUCT_FILTERS.map((p) => p.key))
// Open in our curated order (rankMicaRows), not an active column sort — users can
// still click any header to re-sort, and clearing it returns to this order.
const DEFAULT_SORTING: { id: string; desc: boolean }[] = []

/** Pure row filter — MiCA-only gate + product AND-match. Exported for testing. */
export function filterMicaRows(
	rows: ExchangeMetadataListEntry[],
	opts: { micaOnly: boolean; products: string[] }
): ExchangeMetadataListEntry[] {
	return rows.filter((row) => {
		if (opts.micaOnly && !row.mica_licensed) return false
		if (opts.products.length && !opts.products.every((p) => (row.products ?? []).includes(p))) return false
		return true
	})
}

/** Default display order: full-feature majors first, then secondary venues
 *  (brokers/banks/ramps); within each tier by 24h volume desc (unknown volume
 *  last), then name. Tier beats volume so a high-volume broker can't top a major.
 *  Pure — returns a new array. Exported for testing. */
export function rankMicaRows(rows: ExchangeMetadataListEntry[]): ExchangeMetadataListEntry[] {
	return [...rows].sort(
		(a, b) =>
			(a.secondary ? 1 : 0) - (b.secondary ? 1 : 0) ||
			(b.volume_24h_usd ?? -Infinity) - (a.volume_24h_usd ?? -Infinity) ||
			a.display_name.localeCompare(b.display_name)
	)
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------
export function MicaFinder({ exchanges }: { exchanges: ExchangeMetadataListEntry[] }) {
	const router = useRouter()

	// URL-driven filters. MiCA-only defaults ON (absent param = checked).
	const micaParam = getQueryValue(router.query, 'mica')
	const micaOnly = micaParam == null ? true : isTruthyQueryParam(micaParam)
	const selectedProducts = React.useMemo(
		() => toNonEmptyArrayParam(router.query.products).filter((p) => PRODUCT_KEYS.has(p)),
		[router.query.products]
	)

	const data = React.useMemo(
		() => rankMicaRows(filterMicaRows(exchanges, { micaOnly, products: selectedProducts })),
		[exchanges, micaOnly, selectedProducts]
	)

	const setMicaOnly = React.useCallback(
		(checked: boolean) => {
			// Default is ON, so keep the URL clean by dropping the param when checked.
			void pushShallowQuery(router, { mica: checked ? undefined : 'false' })
		},
		[router]
	)

	const toggleProduct = React.useCallback(
		(key: string) => {
			const next = selectedProducts.includes(key)
				? selectedProducts.filter((p) => p !== key)
				: [...selectedProducts, key]
			void pushShallowQuery(router, { products: next })
		},
		[router, selectedProducts]
	)

	const filters = React.useMemo(
		() => (
			<div className="flex flex-wrap items-center gap-3">
				<span className="flex flex-wrap items-center gap-1.5">
					<span className="text-xs text-(--text-label)">Products:</span>
					{PRODUCT_FILTERS.map((p) => {
						const active = selectedProducts.includes(p.key)
						return (
							<button
								key={p.key}
								onClick={() => toggleProduct(p.key)}
								className={`inline-flex items-center rounded-md border px-2 py-1.5 text-xs font-medium ${
									active
										? 'border-(--old-blue) bg-(--link-button) text-(--link-text)'
										: 'border-(--form-control-border) text-(--text-form) hover:bg-(--link-hover-bg)'
								}`}
							>
								{p.label}
							</button>
						)
					})}
				</span>
				<Checkbox variant="filter" checked={micaOnly} onChange={(e) => setMicaOnly(e.target.checked)}>
					MiCA-licensed only
				</Checkbox>
			</div>
		),
		[micaOnly, selectedProducts, toggleProduct, setMicaOnly]
	)

	return (
		<TableWithSearch
			data={data}
			columns={columns}
			columnToSearch="display_name"
			placeholder="Search exchange..."
			sortingState={DEFAULT_SORTING}
			customFilters={filters}
			showColumnSelect
			csvFileName="mica-exchanges"
		/>
	)
}
