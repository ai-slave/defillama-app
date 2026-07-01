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
const PRIORITY_EXCHANGES = ['coinbase', 'cryptocom', 'gate', 'okx', 'kraken', 'bitstamp', 'bybit', 'backpack'] as const
const PRIORITY_EXCHANGE_RANK: Map<string, number> = new Map(
	PRIORITY_EXCHANGES.map((exchange, index) => [exchange, index])
)
type FeeKind = 'spot' | 'perp'
type FeeTone = 'low' | 'medium' | 'high'
type IconName = React.ComponentProps<typeof Icon>['name']
type KycRequirementKey = 'id' | 'selfie' | 'poa' | 'profile' | 'quiz'
type ExchangePromotion = {
	ends_at?: string | null
	label: string
	priority?: number | null
	source?: { url: string } | null
	starts_at?: string | null
	subtitle?: string | null
	terms_url?: string | null
	title: string
	url?: string | null
}

export type MicaExchange = Pick<
	ExchangeMetadataListEntry,
	| 'depth_summary'
	| 'display_name'
	| 'eu_status'
	| 'exchange'
	| 'kyc_required'
	| 'kyc_short'
	| 'kyc_summary'
	| 'mica_licensed'
	| 'perp_fee'
	| 'products'
	| 'ref_link'
	| 'secondary'
	| 'spot_fee'
	| 'website'
> & {
	promotions?: ExchangePromotion[]
}

const SPOT_FEE_TIER_LIMITS = { low: 0.001, medium: 0.004 }

type KycRequirementIndicator = {
	key: KycRequirementKey
	label: string
	icon: IconName
	className: string
}

const KYC_REQUIREMENT_BY_TOKEN: Record<string, KycRequirementIndicator> = {
	id: {
		key: 'id',
		label: 'Government ID',
		icon: 'id-card',
		className: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400'
	},
	selfie: {
		key: 'selfie',
		label: 'Liveness / selfie check',
		icon: 'scan-face',
		className: 'border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400'
	},
	poa: {
		key: 'poa',
		label: 'Proof of address',
		icon: 'house-plug',
		className: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
	},
	'source-of-income': {
		key: 'profile',
		label: 'Income / economic profile',
		icon: 'briefcase-business',
		className: 'border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-400'
	},
	profile: {
		key: 'profile',
		label: 'Income / economic profile',
		icon: 'briefcase-business',
		className: 'border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-400'
	},
	'mifid quiz': {
		key: 'quiz',
		label: 'Trading knowledge quiz',
		icon: 'clipboard-check',
		className: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
	},
	quiz: {
		key: 'quiz',
		label: 'Trading knowledge quiz',
		icon: 'clipboard-check',
		className: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
	}
}

const FEE_TONE_CLASS: Record<FeeTone, string> = {
	low: 'border-(--success)/30 bg-(--success)/10 text-(--success)',
	medium: 'border-(--warning)/30 bg-(--warning)/10 text-(--warning)',
	high: 'border-(--error)/50 bg-(--cards-bg) text-(--error)'
}

const FEE_TONE_LABEL: Record<FeeTone, string> = {
	low: 'Low fee',
	medium: 'Medium fee',
	high: 'High fee'
}

const SPOT_LIQUIDITY_HELP = 'Aggregated spot orderbook bid and ask depth within 2% of mid price for EU-available spot.'
const PERP_LIQUIDITY_HELP =
	'Aggregated perps orderbook bid and ask depth within 2% of mid price for EU-available perps.'

export function selectActivePromotion(
	row: MicaExchange,
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
function ExchangeNameCell({ row }: { row: MicaExchange }) {
	const outbound = row.ref_link || row.website
	const promotion = selectActivePromotion(row)

	return (
		<span className="flex w-full min-w-0 items-center gap-2">
			<span className="min-w-0 flex-1">
				{outbound ? (
					<a
						href={outbound}
						target="_blank"
						rel="noopener noreferrer"
						className="block truncate text-sm font-medium text-(--link-text) hover:underline"
					>
						{row.display_name}
					</a>
				) : (
					<span className="block truncate text-sm font-medium text-(--text-primary)">{row.display_name}</span>
				)}
			</span>
			<span className="ml-auto flex shrink-0 items-center gap-1.5">
				{promotion ? <PromotionGift promotion={promotion} exchangeName={row.display_name} /> : null}
				{outbound ? (
					<a
						href={outbound}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex h-7 items-center gap-1 rounded-md bg-(--link-button) px-2.5 text-xs font-medium text-(--link-text) hover:bg-(--link-button-hover)"
						aria-label={`Trade on ${row.display_name}`}
					>
						Trade
						<Icon name="arrow-up-right" height={13} width={13} />
					</a>
				) : null}
			</span>
		</span>
	)
}

function PromotionCsvCell({ row }: { row: MicaExchange }) {
	return selectActivePromotion(row)?.label || <span className="text-(--text-disabled)">–</span>
}

function hasProduct(row: MicaExchange, product: string) {
	return row.products.includes(product)
}

function formatFee(fee: number | null | undefined) {
	return fee == null ? null : `${formatPercentage(fee * 100)}%`
}

function getDepthLiquidity(row: MicaExchange) {
	return getSpotDepthLiquidity(row) + getPerpDepthLiquidity(row)
}

function getSpotDepthLiquidity(row: MicaExchange) {
	const depth = row.depth_summary
	return depth.spot_bid_depth_2pct_usd + depth.spot_ask_depth_2pct_usd
}

function getPerpDepthLiquidity(row: MicaExchange) {
	const depth = row.depth_summary
	return depth.perp_bid_depth_2pct_usd + depth.perp_ask_depth_2pct_usd
}

function formatLiquidity(value: number) {
	return abbreviateNumber(value, 2, '$') ?? '–'
}

function formatDepthPair(bid: number, ask: number) {
	if (bid === 0 && ask === 0) return null
	if (bid === 0) return `${formatLiquidity(ask)} ask`
	if (ask === 0) return `${formatLiquidity(bid)} bid`
	return `${formatLiquidity(bid)} bid / ${formatLiquidity(ask)} ask`
}

export function getKycRequirementIndicators(kycShort: string): KycRequirementIndicator[] {
	const indicators: KycRequirementIndicator[] = []
	const seen = new Set<KycRequirementKey>()
	for (const token of kycShort.split('+')) {
		const indicator = KYC_REQUIREMENT_BY_TOKEN[token.trim().toLowerCase()]
		if (!indicator || seen.has(indicator.key)) continue
		seen.add(indicator.key)
		indicators.push(indicator)
	}
	return indicators
}

function getSpotFeeTone(fee: MicaExchange['spot_fee']) {
	const value = fee.taker ?? fee.maker
	if (value == null) return null

	if (value <= SPOT_FEE_TIER_LIMITS.low) return 'low'
	if (value <= SPOT_FEE_TIER_LIMITS.medium) return 'medium'
	return 'high'
}

function FeePairCell({ fee, kind }: { fee: MicaExchange['spot_fee'] | MicaExchange['perp_fee']; kind: FeeKind }) {
	const maker = formatFee(fee.maker)
	const taker = formatFee(fee.taker)
	if (!maker && !taker) return null
	const formattedFee = maker && taker ? `${maker} / ${taker}` : (maker ?? taker)

	if (kind === 'perp') {
		return <span className="whitespace-nowrap tabular-nums">{formattedFee}</span>
	}

	const tone = getSpotFeeTone(fee)
	const label = tone ? FEE_TONE_LABEL[tone] : null

	return (
		<span
			className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-normal whitespace-nowrap tabular-nums ${tone ? FEE_TONE_CLASS[tone] : 'border-(--cards-border) text-(--text-primary)'}`}
			aria-label={label ? `${formattedFee}. ${label}; lower fees are better.` : formattedFee}
		>
			{formattedFee}
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

function LiquidityCell({
	bid,
	ask,
	isPartialCoverage,
	helperText
}: {
	bid: number
	ask: number
	isPartialCoverage: boolean
	helperText: string
}) {
	const total = bid + ask
	if (total === 0) return null

	const tooltip = [formatDepthPair(bid, ask), isPartialCoverage ? 'Partial coverage' : null].filter(Boolean).join('\n')

	return (
		<span className="inline-flex items-center justify-end gap-1.5">
			<Tooltip content={tooltip} className="justify-end">
				<span className="whitespace-nowrap tabular-nums">{formatLiquidity(total)}</span>
			</Tooltip>
			<Tooltip content={helperText}>
				<Icon name="help-circle" height={13} width={13} className="shrink-0 text-(--text-tertiary)" />
			</Tooltip>
		</span>
	)
}

function KycSummaryHovercard({ summary }: { summary: string }) {
	return (
		<Ariakit.HovercardProvider placement="left-start" showTimeout={0} hideTimeout={80}>
			<Ariakit.HovercardAnchor
				render={<button />}
				type="button"
				className="inline-flex size-7 items-center justify-center rounded-md border border-(--cards-border) text-(--text-tertiary) hover:border-(--text-tertiary) hover:bg-(--link-hover-bg) hover:text-(--text-primary) focus-visible:border-(--text-tertiary) focus-visible:bg-(--link-hover-bg) focus-visible:text-(--text-primary)"
				aria-label="Full KYC requirements"
			>
				<Icon name="file-text" height={14} width={14} />
			</Ariakit.HovercardAnchor>
			<Ariakit.Hovercard
				unmountOnHide
				gutter={6}
				className="z-50 w-96 max-w-[calc(100vw-32px)] rounded-md border border-[hsl(204,20%,88%)] bg-(--bg-main) p-3 text-sm leading-snug text-(--text-primary) shadow-lg dark:border-[hsl(204,3%,32%)]"
				portal
			>
				<span className="block break-words whitespace-pre-wrap">{summary}</span>
			</Ariakit.Hovercard>
		</Ariakit.HovercardProvider>
	)
}

function KycCell({ row }: { row: MicaExchange }) {
	if (row.kyc_required == null) return <span className="text-(--text-disabled)">–</span>
	if (!row.kyc_required) return <span className="text-(--success)">No KYC</span>

	const shortSummary = row.kyc_short || 'Required'
	const summary = row.kyc_summary || shortSummary
	const requirements = getKycRequirementIndicators(shortSummary)
	if (!requirements.length) {
		return (
			<Tooltip content={summary}>
				<span className="block truncate text-sm">{shortSummary}</span>
			</Tooltip>
		)
	}

	return (
		<span className="inline-flex items-center gap-1.5" aria-label={summary}>
			{requirements.map((requirement) => (
				<Tooltip key={requirement.key} content={requirement.label}>
					<span
						className={`inline-flex size-7 items-center justify-center rounded-md border ${requirement.className}`}
						aria-label={requirement.label}
					>
						<Icon name={requirement.icon} height={15} width={15} />
					</span>
				</Tooltip>
			))}
			{summary !== shortSummary ? <KycSummaryHovercard summary={summary} /> : null}
		</span>
	)
}

// ---------------------------------------------------------------------------
// Columns — compact preferred/min widths. The page opts into `table-layout: auto`,
// so these guide the browser instead of forcing a fixed column grid.
// Sortable columns return a sortable primitive from accessorFn, with `?? undefined`
// so missing values sort last; non-sortable columns set enableSorting: false.
// ---------------------------------------------------------------------------
const columnHelper = createColumnHelper<MicaExchange>()

const columns: ColumnDef<MicaExchange, any>[] = [
	columnHelper.accessor('display_name', {
		id: 'display_name',
		header: 'Exchange',
		enableSorting: false,
		cell: ({ row }) => <ExchangeNameCell row={row.original} />,
		meta: { headerClassName: 'w-[260px] min-w-[240px]' }
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
	columnHelper.accessor(getSpotDepthLiquidity, {
		id: 'spot_liquidity',
		header: 'Spot liquidity',
		cell: ({ row }) => (
			<LiquidityCell
				bid={row.original.depth_summary.spot_bid_depth_2pct_usd}
				ask={row.original.depth_summary.spot_ask_depth_2pct_usd}
				isPartialCoverage={row.original.depth_summary.isPartialCoverage}
				helperText={SPOT_LIQUIDITY_HELP}
			/>
		),
		meta: {
			headerClassName: 'w-[132px] min-w-[120px] whitespace-nowrap',
			align: 'end' as const,
			headerHelperText: SPOT_LIQUIDITY_HELP
		}
	}),
	columnHelper.accessor(getPerpDepthLiquidity, {
		id: 'perp_liquidity',
		header: 'Perp liquidity',
		cell: ({ row }) => (
			<LiquidityCell
				bid={row.original.depth_summary.perp_bid_depth_2pct_usd}
				ask={row.original.depth_summary.perp_ask_depth_2pct_usd}
				isPartialCoverage={row.original.depth_summary.isPartialCoverage}
				helperText={PERP_LIQUIDITY_HELP}
			/>
		),
		meta: {
			headerClassName: 'w-[132px] min-w-[120px] whitespace-nowrap',
			align: 'end' as const,
			headerHelperText: PERP_LIQUIDITY_HELP
		}
	}),
	columnHelper.accessor((row) => row.spot_fee.taker ?? undefined, {
		id: 'spot_fees',
		header: 'Spot fees',
		cell: ({ row }) => <FeePairCell fee={row.original.spot_fee} kind="spot" />,
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
	columnHelper.accessor((row) => row.perp_fee.taker ?? undefined, {
		id: 'perp_fees',
		header: 'Perp fees',
		cell: ({ row }) => <FeePairCell fee={row.original.perp_fee} kind="perp" />,
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
export function filterMicaRows(rows: MicaExchange[], opts: { products: string[] }): MicaExchange[] {
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
export function rankMicaRows(rows: MicaExchange[]): MicaExchange[] {
	return [...rows].sort(
		(a, b) =>
			(PRIORITY_EXCHANGE_RANK.get(a.exchange) ?? Infinity) - (PRIORITY_EXCHANGE_RANK.get(b.exchange) ?? Infinity) ||
			getDepthLiquidity(b) - getDepthLiquidity(a) ||
			(a.secondary ? 1 : 0) - (b.secondary ? 1 : 0) ||
			(a.spot_fee.taker ?? Infinity) - (b.spot_fee.taker ?? Infinity) ||
			a.display_name.localeCompare(b.display_name)
	)
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------
export function MicaFinder({ exchanges }: { exchanges: MicaExchange[] }) {
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
