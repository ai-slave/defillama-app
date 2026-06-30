import * as Ariakit from '@ariakit/react'
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { Checkbox } from '~/components/Checkbox'
import { Icon } from '~/components/Icon'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { Tooltip } from '~/components/Tooltip'
import { abbreviateNumber, formatPercentage } from '~/utils'
import { pushShallowQuery, toNonEmptyArrayParam } from '~/utils/routerQuery'
import type { ExchangeMetadataListEntry } from './api.types'

const PERP_PRODUCT = 'perp'
const PRIORITY_EXCHANGES = ['okx', 'bybit', 'coinbase', 'cryptocom'] as const
const PRIORITY_EXCHANGE_RANK: Map<string, number> = new Map(
	PRIORITY_EXCHANGES.map((exchange, index) => [exchange, index])
)
type ExchangePromotion = NonNullable<ExchangeMetadataListEntry['promotions']>[number]

export function selectActivePromotion(
	row: ExchangeMetadataListEntry,
	today = new Date().toISOString().slice(0, 10)
): ExchangePromotion | null {
	const promotions = row.promotions?.filter((promotion) => {
		if (promotion.starts_at && promotion.starts_at > today) return false
		if (promotion.ends_at && promotion.ends_at < today) return false
		return true
	})
	if (!promotions?.length) return null

	return [...promotions].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.label.localeCompare(b.label))[0]
}

function cleanPromotionSubtitle(promotion: ExchangePromotion) {
	return promotion.subtitle?.replace(/\s*T&Cs apply\.?$/i, '').trim()
}

function hasTermsCopy(promotion: ExchangePromotion) {
	return Boolean(promotion.terms_url || /\s*T&Cs apply\.?$/i.test(promotion.subtitle ?? ''))
}

function promotionLinks(promotion: ExchangePromotion) {
	const links: { label: string; href: string }[] = []
	if (promotion.url) links.push({ label: 'Campaign page', href: promotion.url })
	if (promotion.terms_url && promotion.terms_url !== promotion.url)
		links.push({ label: 'Terms', href: promotion.terms_url })
	if (promotion.source?.url && promotion.source.url !== promotion.url && promotion.source.url !== promotion.terms_url) {
		links.push({ label: 'Source', href: promotion.source.url })
	}
	return links
}

function PromotionGift({ promotion, exchangeName }: { promotion: ExchangePromotion; exchangeName: string }) {
	const subtitle = cleanPromotionSubtitle(promotion)
	const links = promotionLinks(promotion)

	return (
		<Ariakit.HovercardProvider placement="right-start" showTimeout={0} hideTimeout={50}>
			<Ariakit.HovercardAnchor
				render={<button />}
				type="button"
				className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-(--cards-border) bg-(--bg-main) text-(--text-secondary) hover:border-(--text-tertiary) hover:bg-(--link-hover-bg) hover:text-(--text-primary) focus-visible:border-(--text-tertiary) focus-visible:bg-(--link-hover-bg) focus-visible:text-(--text-primary)"
				aria-label={`${exchangeName} promotion: ${promotion.label}`}
			>
				<Icon name="gift" height={15} width={15} />
			</Ariakit.HovercardAnchor>
			<Ariakit.Hovercard
				unmountOnHide
				gutter={6}
				className="z-50 w-72 max-w-[calc(100vw-32px)] overflow-hidden rounded-md border border-[hsl(204,20%,88%)] bg-(--bg-main) text-sm shadow-lg dark:border-[hsl(204,3%,32%)]"
				portal
			>
				<span className="flex flex-col gap-3 p-3">
					<span className="flex items-start gap-2">
						<span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-(--cards-border) bg-(--bg-main) text-(--text-secondary)">
							<Icon name="gift" height={15} width={15} />
						</span>
						<span className="flex min-w-0 flex-col gap-1">
							<span className="text-sm font-semibold text-(--text-primary)">{promotion.title}</span>
							<span className="text-xs font-medium text-(--link-text)">{promotion.label}</span>
						</span>
					</span>
					{subtitle ? <span className="text-sm leading-snug text-(--text-secondary)">{subtitle}</span> : null}
					<span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-(--text-tertiary)">
						{promotion.ends_at ? <span>Ends {promotion.ends_at}</span> : null}
						{hasTermsCopy(promotion) ? <span>T&Cs apply</span> : null}
					</span>
				</span>
				{links.length ? (
					<span className="flex flex-col border-t border-(--cards-border)">
						{links.map((link) => (
							<a
								key={`${link.label}:${link.href}`}
								href={link.href}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2 px-3 py-2 text-xs text-(--text-primary) hover:bg-(--link-hover-bg)"
							>
								<Icon name="gift" height={12} width={12} className="shrink-0 text-(--link-text)" />
								<span>{link.label}</span>
								<Icon
									name="arrow-up-right"
									height={12}
									width={12}
									className="ml-auto shrink-0 text-(--text-tertiary)"
								/>
							</a>
						))}
					</span>
				) : null}
			</Ariakit.Hovercard>
		</Ariakit.HovercardProvider>
	)
}

// Single link per row -> the exchange site (our referral when we have one, else
// the plain website). Opens in a new tab.
function ExchangeNameCell({ row }: { row: ExchangeMetadataListEntry }) {
	const outbound = row.ref_link || row.website
	const promotion = selectActivePromotion(row)

	return (
		<span className="flex min-w-0 items-center gap-2">
			<span className="min-w-0">
				{outbound ? (
					<a
						href={outbound}
						target="_blank"
						rel="noopener noreferrer"
						className="min-w-0 truncate text-sm font-medium text-(--link-text) hover:underline"
					>
						{row.display_name}
					</a>
				) : (
					<span className="truncate text-sm font-medium text-(--text-primary)">{row.display_name}</span>
				)}
			</span>
			<span className="ml-auto flex shrink-0 items-center gap-1.5">
				{promotion ? <PromotionGift promotion={promotion} exchangeName={row.display_name} /> : null}
				{outbound ? (
					<a
						href={outbound}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex size-7 items-center justify-center rounded-md bg-(--link-button) text-(--link-text) hover:bg-(--link-button-hover)"
						aria-label={`Open ${row.display_name}`}
					>
						<Icon name="arrow-up-right" height={14} width={14} />
					</a>
				) : null}
			</span>
		</span>
	)
}

function PromotionCsvCell({ row }: { row: ExchangeMetadataListEntry }) {
	return selectActivePromotion(row)?.label || <span className="text-(--text-disabled)">–</span>
}

function hasProduct(row: ExchangeMetadataListEntry, product: string) {
	return row.products.includes(product)
}

function formatFee(fee: number | null | undefined) {
	return fee == null ? '–' : `${formatPercentage(fee * 100)}%`
}

function FeePairCell({
	fee,
	available = true
}: {
	fee: ExchangeMetadataListEntry['spot_fee'] | ExchangeMetadataListEntry['perp_fee']
	available?: boolean
}) {
	if (!available || (fee.maker == null && fee.taker == null))
		return <span className="whitespace-nowrap text-(--text-disabled)">–</span>
	return (
		<span className="whitespace-nowrap tabular-nums">
			{formatFee(fee.maker)} / {formatFee(fee.taker)}
		</span>
	)
}

function PerpsCell({ available }: { available: boolean }) {
	return available ? (
		<span className="inline-flex items-center gap-1 text-(--success)" aria-label="Perps available">
			<Icon name="check" height={16} width={16} />
			<span className="text-sm">Yes</span>
		</span>
	) : (
		<span className="inline-flex items-center gap-1 text-(--text-disabled)" aria-label="Perps unavailable">
			<Icon name="x" height={16} width={16} />
			<span className="text-sm">No</span>
		</span>
	)
}

function KycCell({ row }: { row: ExchangeMetadataListEntry }) {
	if (row.kyc_required == null) return <span className="text-(--text-disabled)">–</span>
	if (!row.kyc_required) return <span className="text-(--success)">No KYC</span>

	const summary = row.kyc_summary || 'Required'
	return (
		<Tooltip content={summary}>
			<span className="block truncate text-sm">{summary}</span>
		</Tooltip>
	)
}

// ---------------------------------------------------------------------------
// Columns — compact preferred/min widths. The page opts into `table-layout: auto`,
// so these guide the browser instead of forcing a fixed column grid.
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
		meta: { headerClassName: 'w-[180px] min-w-[160px]' }
	}),
	columnHelper.accessor((row) => row.ref_link || row.website || undefined, {
		id: 'website',
		header: 'Website',
		enableSorting: false,
		cell: ({ getValue }) => getValue() || <span className="text-(--text-disabled)">–</span>,
		meta: {
			headerClassName: 'w-[180px] min-w-[180px]',
			hidden: true,
			csvOnly: true,
			csvHeader: 'Website'
		}
	}),
	columnHelper.accessor((row) => selectActivePromotion(row)?.label, {
		id: 'promotion',
		header: 'Promotion',
		enableSorting: false,
		cell: ({ row }) => <PromotionCsvCell row={row.original} />,
		meta: {
			headerClassName: 'w-[160px] min-w-[160px]',
			hidden: true,
			csvOnly: true,
			csvHeader: 'Promotion'
		}
	}),
	columnHelper.accessor((row) => selectActivePromotion(row)?.url || undefined, {
		id: 'promotion_url',
		header: 'Promotion URL',
		enableSorting: false,
		cell: ({ getValue }) => getValue() || <span className="text-(--text-disabled)">–</span>,
		meta: {
			headerClassName: 'w-[180px] min-w-[180px]',
			hidden: true,
			csvOnly: true,
			csvHeader: 'Promotion URL'
		}
	}),
	columnHelper.accessor((row) => row.volume_24h_usd ?? undefined, {
		id: 'liquidity',
		header: 'Liquidity',
		cell: ({ getValue }) => abbreviateNumber(getValue(), 2, '$') ?? <span className="text-(--text-disabled)">–</span>,
		meta: {
			headerClassName: 'w-[104px] min-w-[96px]',
			align: 'end' as const,
			headerHelperText: '24h trading volume for comparing where liquidity is deepest.'
		}
	}),
	columnHelper.accessor((row) => row.spot_fee.taker ?? undefined, {
		id: 'spot_fees',
		header: 'Spot fees',
		cell: ({ row }) => <FeePairCell fee={row.original.spot_fee} />,
		meta: {
			headerClassName: 'w-[108px] min-w-[100px] whitespace-nowrap',
			align: 'end' as const,
			headerHelperText: 'Regular-tier spot maker / taker fees. Sorts by taker fee.'
		}
	}),
	columnHelper.accessor((row) => (hasProduct(row, PERP_PRODUCT) ? 1 : 0), {
		id: 'perps',
		header: 'Perps',
		cell: ({ row }) => <PerpsCell available={hasProduct(row.original, PERP_PRODUCT)} />,
		meta: {
			headerClassName: 'w-[84px] min-w-[72px]',
			headerHelperText: 'Whether perpetuals are available to EU users.'
		}
	}),
	columnHelper.accessor((row) => (hasProduct(row, PERP_PRODUCT) ? (row.perp_fee.taker ?? undefined) : undefined), {
		id: 'perp_fees',
		header: 'Perp fees',
		cell: ({ row }) => <FeePairCell fee={row.original.perp_fee} available={hasProduct(row.original, PERP_PRODUCT)} />,
		meta: {
			headerClassName: 'w-[108px] min-w-[100px] whitespace-nowrap',
			align: 'end' as const,
			headerHelperText: 'Regular-tier perpetuals maker / taker fees. Sorts by taker fee.'
		}
	}),
	columnHelper.accessor(
		(row) => row.kyc_summary ?? (row.kyc_required == null ? undefined : row.kyc_required ? 'Required' : 'No KYC'),
		{
			id: 'kyc',
			header: 'KYC',
			enableSorting: false,
			cell: ({ row }) => <KycCell row={row.original} />,
			meta: {
				headerClassName: 'w-[240px] min-w-[200px]',
				headerHelperText: 'Documents and verification steps required to use the exchange.'
			}
		}
	)
]

// ---------------------------------------------------------------------------
// Product filter — keys match the feed's segment availability list.
// ---------------------------------------------------------------------------
const PRODUCT_KEYS = new Set([PERP_PRODUCT])
// Open in our curated order (rankMicaRows), not an active column sort — users can
// still click any header to re-sort, and clearing it returns to this order.
const DEFAULT_SORTING: { id: string; desc: boolean }[] = []

/** Pure row filter — MiCA + EU-usable gate, then product AND-match. Exported for testing. */
export function filterMicaRows(
	rows: ExchangeMetadataListEntry[],
	opts: { products: string[] }
): ExchangeMetadataListEntry[] {
	return rows.filter((row) => {
		if (!row.mica_licensed) return false
		if (row.eu_status && row.eu_status !== 'available') return false
		if (opts.products.length && !opts.products.every((p) => row.products.includes(p))) return false
		return true
	})
}

/** Default display order: hand-picked lead venues first, then deeper liquidity,
 *  full-feature venues, and cheaper spot taker fee. Pure — returns a new array.
 *  Exported for testing. */
export function rankMicaRows(rows: ExchangeMetadataListEntry[]): ExchangeMetadataListEntry[] {
	return [...rows].sort(
		(a, b) =>
			(PRIORITY_EXCHANGE_RANK.get(a.exchange) ?? Infinity) - (PRIORITY_EXCHANGE_RANK.get(b.exchange) ?? Infinity) ||
			(b.volume_24h_usd ?? -Infinity) - (a.volume_24h_usd ?? -Infinity) ||
			(a.secondary ? 1 : 0) - (b.secondary ? 1 : 0) ||
			(a.spot_fee.taker ?? Infinity) - (b.spot_fee.taker ?? Infinity) ||
			a.display_name.localeCompare(b.display_name)
	)
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------
export function MicaFinder({ exchanges }: { exchanges: ExchangeMetadataListEntry[] }) {
	const router = useRouter()

	const selectedProducts = React.useMemo(
		() => toNonEmptyArrayParam(router.query.products).filter((p) => PRODUCT_KEYS.has(p)),
		[router.query.products]
	)
	const perpsOnly = selectedProducts.includes(PERP_PRODUCT)

	const data = React.useMemo(
		() => rankMicaRows(filterMicaRows(exchanges, { products: selectedProducts })),
		[exchanges, selectedProducts]
	)

	const setPerpsOnly = React.useCallback(
		(checked: boolean) => {
			void pushShallowQuery(router, { products: checked ? [PERP_PRODUCT] : undefined })
		},
		[router]
	)

	const filters = React.useMemo(
		() => (
			<div className="flex flex-wrap items-center gap-3">
				<Checkbox variant="filter" checked={perpsOnly} onChange={(e) => setPerpsOnly(e.target.checked)}>
					Perps only
				</Checkbox>
			</div>
		),
		[perpsOnly, setPerpsOnly]
	)

	return (
		<TableWithSearch
			data={data}
			columns={columns}
			columnToSearch="display_name"
			placeholder="Search exchange..."
			sortingState={DEFAULT_SORTING}
			customFilters={filters}
			csvFileName="mica-exchanges"
			skipVirtualization
			tableLayout="auto"
		/>
	)
}
