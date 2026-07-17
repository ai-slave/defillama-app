import * as Ariakit from '@ariakit/react'
import { type CellContext, type ColumnDef, createColumnHelper, flexRender } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { Icon } from '~/components/Icon'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { Checkbox } from '~/ui/Checkbox'
import { popoverHovercardSurfaceStyles } from '~/ui/Popover'
import { Tooltip } from '~/ui/Tooltip'
import { abbreviateNumber, formatPercentage } from '~/utils'
import { pushShallowQuery, toNonEmptyArrayParam } from '~/utils/routerQuery'
import type { ExchangeMetadataListEntry, ExchangeMetadataRampCost } from './api.types'

const PERP_PRODUCT = 'perp'
const PRIORITY_EXCHANGES = ['bybit', 'coinbase', 'cryptocom', 'gate', 'okx', 'kraken', 'bitstamp', 'backpack'] as const
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
	| 'market_count'
	| 'mica_licensed'
	| 'perp_fee'
	| 'own_eu_orderbook'
	| 'products'
	| 'ramp_cost_1k'
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
		className: 'border-warning/30 bg-warning/10 text-warning dark:text-warning'
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
	low: 'border-data-up bg-data-up/10 text-data-up',
	medium: 'border-warning bg-warning/10 text-warning',
	high: 'border-data-down bg-surface text-data-down'
}

const FEE_TONE_LABEL: Record<FeeTone, string> = {
	low: 'Low fee',
	medium: 'Medium fee',
	high: 'High fee'
}

const SPOT_LIQUIDITY_HELP = 'Aggregated spot orderbook bid and ask depth within 2% of mid price for EU-available spot.'
const PERP_LIQUIDITY_HELP =
	'Aggregated perps orderbook bid and ask depth within 2% of mid price for EU-available perps.'
const SPOT_TIGHT_LIQUIDITY_HELP =
	'Aggregated spot orderbook bid and ask depth within 0.5% of mid price the tight band, closest to executable liquidity at the touch.'
const PERP_TIGHT_LIQUIDITY_HELP =
	'Aggregated perps orderbook bid and ask depth within 0.5% of mid price. the tight band, closest to executable liquidity at the touch.'
const MARKET_COUNT_HELP = 'Number of trading markets available to EU users in the metadata feed.'
const ON_RAMP_COST_HELP =
	'Total cost to turn €1,000 into BTC in your own wallet: SEPA deposit + taker fee + orderbook slippage + BTC withdrawal fee. Hover for the full breakdown.'
const OFF_RAMP_COST_HELP =
	'Total cost to turn €1,000 of BTC into EUR in your bank account: BTC network fee + taker fee + orderbook slippage + SEPA withdrawal. Hover for the full breakdown.'

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

function PromotionGift({
	promotion,
	exchange,
	exchangeName
}: {
	promotion: ExchangePromotion
	exchange: string
	exchangeName: string
}) {
	const subtitle = cleanPromotionSubtitle(promotion)
	const links = promotionLinks(promotion)

	return (
		<Ariakit.HovercardProvider placement="right-start" showTimeout={0} hideTimeout={50}>
			<Ariakit.HovercardAnchor
				render={<button />}
				type="button"
				className="hover-wash inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-subtle bg-surface text-secondary hover:border-strong hover:text-primary focus-visible:border-strong focus-visible:text-primary"
				aria-label={`${exchangeName} promotion: ${promotion.label}`}
			>
				<Icon name="gift" height={15} width={15} />
			</Ariakit.HovercardAnchor>
			<Ariakit.Hovercard
				unmountOnHide
				gutter={6}
				overflowPadding={16}
				className={`${popoverHovercardSurfaceStyles} w-72 overflow-hidden p-0`}
				portal
			>
				<span className="flex flex-col gap-3 p-3">
					<span className="flex items-start gap-2">
						<span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-subtle bg-surface text-secondary">
							<Icon name="gift" height={15} width={15} />
						</span>
						<span className="flex min-w-0 flex-col gap-1">
							<span className="label-md text-primary">{promotion.title}</span>
							<span className="label-sm text-link">{promotion.label}</span>
						</span>
					</span>
					{subtitle ? <span className="body-sm text-secondary">{subtitle}</span> : null}
					<span className="flex flex-wrap gap-x-3 gap-y-1 label-sm text-tertiary">
						{promotion.ends_at ? <span>Ends {promotion.ends_at}</span> : null}
						{hasTermsCopy(promotion) ? <span>T&Cs apply</span> : null}
					</span>
				</span>
				{links.length ? (
					<span className="flex flex-col border-t border-subtle">
						{links.map((link) => (
							<a
								key={`${link.label}:${link.href}`}
								href={link.href}
								target="_blank"
								rel="noopener noreferrer"
								data-umami-event="mica-promotion-click"
								data-umami-event-exchange={exchange}
								data-umami-event-link={link.label}
								className="flex items-center gap-2 px-3 py-2 label-sm text-primary hover:bg-hover-row"
							>
								<Icon name="gift" height={12} width={12} className="shrink-0 text-link" />
								<span>{link.label}</span>
								<Icon name="arrow-up-right" height={12} width={12} className="ml-auto shrink-0 text-tertiary" />
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
	// Native umami click tracking — the tracker auto-reports any element with these attributes.
	const trackProps = {
		'data-umami-event': 'mica-exchange-click',
		'data-umami-event-exchange': row.exchange,
		'data-umami-event-type': row.ref_link ? 'ref' : 'website'
	}

	return (
		<span className="flex w-full min-w-0 items-center gap-2">
			<span className="min-w-0 flex-1">
				{outbound ? (
					<a
						href={outbound}
						target="_blank"
						rel="noopener noreferrer"
						{...trackProps}
						data-umami-event-placement="name"
						className="block truncate label-md text-link hover:underline"
					>
						{row.display_name}
					</a>
				) : (
					<span className="block truncate label-md text-primary">{row.display_name}</span>
				)}
			</span>
			<span className="ml-auto flex shrink-0 items-center gap-1.5">
				{promotion ? (
					<PromotionGift promotion={promotion} exchange={row.exchange} exchangeName={row.display_name} />
				) : null}
				{outbound ? (
					<a
						href={outbound}
						target="_blank"
						rel="noopener noreferrer"
						{...trackProps}
						data-umami-event-placement="trade"
						className="inline-flex h-7 items-center gap-1 rounded-md border border-medium px-2.5 label-sm text-link hover:bg-hover-row"
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
	return selectActivePromotion(row)?.label || <span className="text-tertiary">–</span>
}

function hasProduct(row: MicaExchange, product: string) {
	return row.products.includes(product)
}

function formatFee(fee: number | null | undefined) {
	return fee == null ? null : `${formatPercentage(fee * 100)}%`
}

type DepthBand = '2pct' | '05pct'

function getDepthPair(row: MicaExchange, kind: FeeKind, band: DepthBand) {
	const depth = row.depth_summary
	return {
		bid: depth[`${kind}_bid_depth_${band}_usd`] ?? 0,
		ask: depth[`${kind}_ask_depth_${band}_usd`] ?? 0
	}
}

function getDepthSum(row: MicaExchange, kind: FeeKind, band: DepthBand) {
	const { bid, ask } = getDepthPair(row, kind, band)
	return bid + ask
}

function getDepthLiquidity(row: MicaExchange) {
	return getDepthSum(row, 'spot', '2pct') + getDepthSum(row, 'perp', '2pct')
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
		return <span className="whitespace-nowrap">{formattedFee}</span>
	}

	const tone = getSpotFeeTone(fee)
	const label = tone ? FEE_TONE_LABEL[tone] : null

	return (
		<span
			className={`inline-flex rounded-md border px-2 py-0.5 label-sm whitespace-nowrap ${tone ? FEE_TONE_CLASS[tone] : 'border-subtle text-primary'}`}
			aria-label={label ? `${formattedFee}. ${label}; lower fees are better.` : formattedFee}
		>
			{formattedFee}
		</span>
	)
}

function PerpsCell({ available }: { available: boolean }) {
	return available ? (
		<span className="inline-flex items-center gap-1 text-data-up" aria-label="Perps available">
			<Icon name="check" height={16} width={16} />
			<span className="body-sm">Yes</span>
		</span>
	) : (
		<span className="inline-flex items-center gap-1 text-tertiary" aria-label="Perps unavailable">
			<Icon name="x" height={16} width={16} />
			<span className="body-sm">No</span>
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
				<span className="whitespace-nowrap">{formatLiquidity(total)}</span>
			</Tooltip>
			<Tooltip content={helperText}>
				<Icon name="help-circle" height={13} width={13} className="shrink-0 text-tertiary" />
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
				className="inline-flex size-7 items-center justify-center rounded-lg border border-subtle text-tertiary hover:border-strong hover:bg-hover-row hover:text-primary focus-visible:border-strong focus-visible:bg-hover-row focus-visible:text-primary"
				aria-label="Full KYC requirements"
			>
				<Icon name="file-text" height={14} width={14} />
			</Ariakit.HovercardAnchor>
			<Ariakit.Hovercard
				unmountOnHide
				gutter={6}
				overflowPadding={16}
				className={`${popoverHovercardSurfaceStyles} w-96 p-3 leading-snug text-primary`}
				portal
			>
				<span className="block break-words whitespace-pre-wrap">{summary}</span>
			</Ariakit.Hovercard>
		</Ariakit.HovercardProvider>
	)
}

// ---------------------------------------------------------------------------
// €1k ramp cost — total badge + hovercard breaking down every component.
// Upstream figures are USD, rendered with a € sign (EU page; EUR≈USD here).
// ---------------------------------------------------------------------------

type RampDirection = 'on_ramp' | 'off_ramp'

const RAMP_COST_TIER_LIMITS = { low: 0.005, medium: 0.01 }

const RAMP_DIRECTION_STEPS: Record<RampDirection, string> = {
	on_ramp: 'Deposit EUR (SEPA) → buy BTC → withdraw to your wallet',
	off_ramp: 'Deposit BTC → sell → withdraw EUR (SEPA)'
}

function getRampCostTone(pct: number | null): FeeTone | null {
	if (pct == null) return null
	if (pct <= RAMP_COST_TIER_LIMITS.low) return 'low'
	if (pct <= RAMP_COST_TIER_LIMITS.medium) return 'medium'
	return 'high'
}

function getRampCostTotalEur(row: MicaExchange, direction: RampDirection) {
	return row.ramp_cost_1k?.[direction]?.total_usd ?? undefined
}

function formatBtcAmount(value: number | null) {
	return value == null ? null : `${value.toFixed(8).replace(/0+$/, '')} BTC`
}

function getRampCostBreakdown(cost: ExchangeMetadataRampCost, direction: RampDirection) {
	const leg = cost[direction]
	const assumptions = cost.assumptions
	const eur = (usd: number | null) => (usd == null ? null : `€${usd.toFixed(2)}`)
	const takerPct = assumptions.taker_fee != null ? `${formatPercentage(assumptions.taker_fee * 100)}%` : null
	const transferBtc = formatBtcAmount(
		direction === 'on_ramp' ? assumptions.btc_withdrawal_fee_btc : assumptions.btc_network_fee_btc
	)

	return [
		{ label: `SEPA ${direction === 'on_ramp' ? 'deposit' : 'withdrawal'}`, value: eur(leg.fiat_fee_usd) },
		{ label: takerPct ? `Taker fee (${takerPct})` : 'Taker fee', value: eur(leg.trade_fee_usd) },
		{ label: 'Slippage vs mid price', value: eur(leg.slippage_usd) },
		{
			label:
				direction === 'on_ramp'
					? `BTC withdrawal fee${transferBtc ? ` (${transferBtc})` : ''}`
					: `BTC network fee${transferBtc ? ` (${transferBtc})` : ''}`,
			value: eur(leg.transfer_fee_usd)
		}
	]
}

function RampCostCell({ row, direction }: { row: MicaExchange; direction: RampDirection }) {
	const cost = row.ramp_cost_1k
	const leg = cost?.[direction]
	if (!cost || !leg) return null

	const breakdown = getRampCostBreakdown(cost, direction)
	const totalEur = getRampCostTotalEur(row, direction)
	const tone = getRampCostTone(leg.total_pct)
	const notionalEur = cost.notional_usd

	return (
		<Ariakit.HovercardProvider placement="left-start" showTimeout={0} hideTimeout={80}>
			<Ariakit.HovercardAnchor
				render={<button />}
				type="button"
				className={
					totalEur != null
						? `inline-flex rounded-md border px-2 py-0.5 label-sm whitespace-nowrap ${tone ? FEE_TONE_CLASS[tone] : 'border-subtle text-primary'}`
						: 'inline-flex rounded-md border border-subtle px-2 py-0.5 label-sm whitespace-nowrap text-tertiary'
				}
				aria-label={`${row.display_name} €${notionalEur.toLocaleString('en-US')} ${direction === 'on_ramp' ? 'on-ramp' : 'off-ramp'} cost breakdown`}
			>
				{totalEur != null ? `€${totalEur.toFixed(2)}` : '?'}
			</Ariakit.HovercardAnchor>
			<Ariakit.Hovercard
				unmountOnHide
				gutter={6}
				overflowPadding={16}
				className={`${popoverHovercardSurfaceStyles} w-80 p-3 text-primary`}
				portal
			>
				<div className="flex flex-col gap-2">
					<span className="body-sm text-secondary">{RAMP_DIRECTION_STEPS[direction]}</span>
					<span className="label-sm text-tertiary">
						€{notionalEur.toLocaleString('en-US')} notional on {cost.pair ?? '–'}
					</span>
					<span className="flex flex-col gap-1 border-t border-subtle pt-2">
						{breakdown.map((item) => (
							<span key={item.label} className="flex items-baseline justify-between gap-3 body-sm">
								<span className="text-secondary">{item.label}</span>
								<span className={item.value == null ? 'text-tertiary' : 'text-primary'}>{item.value ?? 'unknown'}</span>
							</span>
						))}
					</span>
					<span className="flex items-baseline justify-between gap-3 border-t border-subtle pt-2 label-md">
						<span>Total</span>
						{totalEur != null ? (
							<span>
								€{totalEur.toFixed(2)}
								{leg.total_pct != null ? (
									<span className="text-tertiary"> ({formatPercentage(leg.total_pct * 100)}%)</span>
								) : null}
							</span>
						) : (
							<span className="text-tertiary">unavailable — a component is unknown</span>
						)}
					</span>
				</div>
			</Ariakit.Hovercard>
		</Ariakit.HovercardProvider>
	)
}

function KycCell({ row }: { row: MicaExchange }) {
	if (row.kyc_required == null) return <span className="text-tertiary">–</span>
	if (!row.kyc_required) return <span className="text-data-up">No KYC</span>

	const shortSummary = row.kyc_short || 'Required'
	const summary = row.kyc_summary || shortSummary
	const requirements = getKycRequirementIndicators(shortSummary)
	if (!requirements.length) {
		return (
			<Tooltip content={summary}>
				<span className="block truncate body-sm">{shortSummary}</span>
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

function MarketCountCell({ row }: { row: MicaExchange }) {
	if (row.market_count == null) return null

	return (
		<span className="inline-flex items-center justify-end gap-1.5">
			<span className="whitespace-nowrap">{row.market_count.toLocaleString('en-US')}</span>
			{row.own_eu_orderbook ? (
				<Tooltip content={`${MARKET_COUNT_HELP}\nOwn EU orderbook.`} className="justify-end">
					<Icon name="help-circle" height={13} width={13} className="shrink-0 text-tertiary" />
				</Tooltip>
			) : null}
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

function liquidityColumn(kind: FeeKind, band: DepthBand, header: string, help: string) {
	return columnHelper.accessor((row) => getDepthSum(row, kind, band), {
		id: `${kind}_liquidity${band === '05pct' ? '_05' : ''}`,
		header,
		cell: ({ row }) => {
			const { bid, ask } = getDepthPair(row.original, kind, band)
			return (
				<LiquidityCell
					bid={bid}
					ask={ask}
					isPartialCoverage={row.original.depth_summary.isPartialCoverage}
					helperText={help}
				/>
			)
		},
		meta: {
			headerClassName: 'w-[124px] min-w-[110px] whitespace-nowrap',
			align: 'end' as const,
			headerHelperText: help
		}
	})
}

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
		cell: ({ getValue }) => getValue() || <span className="text-tertiary">–</span>,
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
		cell: ({ getValue }) => getValue() || <span className="text-tertiary">–</span>,
		meta: {
			headerClassName: 'w-[180px] min-w-[180px]',
			hidden: true,
			csvOnly: true,
			csvHeader: 'Promotion URL'
		}
	}),
	liquidityColumn('spot', '2pct', 'Spot ±2%', SPOT_LIQUIDITY_HELP),
	liquidityColumn('spot', '05pct', 'Spot ±0.5%', SPOT_TIGHT_LIQUIDITY_HELP),
	liquidityColumn('perp', '2pct', 'Perp ±2%', PERP_LIQUIDITY_HELP),
	liquidityColumn('perp', '05pct', 'Perp ±0.5%', PERP_TIGHT_LIQUIDITY_HELP),
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
	columnHelper.accessor((row) => getRampCostTotalEur(row, 'on_ramp'), {
		id: 'ramp_cost_on',
		header: '€1k on-ramp',
		cell: ({ row }) => <RampCostCell row={row.original} direction="on_ramp" />,
		meta: {
			headerClassName: 'w-[124px] min-w-[110px] whitespace-nowrap',
			align: 'end' as const,
			headerHelperText: ON_RAMP_COST_HELP
		}
	}),
	columnHelper.accessor((row) => getRampCostTotalEur(row, 'off_ramp'), {
		id: 'ramp_cost_off',
		header: '€1k off-ramp',
		cell: ({ row }) => <RampCostCell row={row.original} direction="off_ramp" />,
		meta: {
			headerClassName: 'w-[124px] min-w-[110px] whitespace-nowrap',
			align: 'end' as const,
			headerHelperText: OFF_RAMP_COST_HELP
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
	),
	columnHelper.accessor((row) => row.market_count ?? undefined, {
		id: 'market_count',
		header: 'Markets',
		cell: ({ row }) => <MarketCountCell row={row.original} />,
		meta: {
			headerClassName: 'w-[96px] min-w-[90px] whitespace-nowrap',
			align: 'end' as const,
			headerHelperText: MARKET_COUNT_HELP
		}
	})
]

// Bybit row highlight — wraps each column's cell renderer with a full-bleed tint (and, on the
// first/sticky column, a left accent bar) instead of touching the shared table renderer, which
// every other table on the site also uses. The overlay is absolutely positioned within the cell
// (`relative` + `z-0` below make the <td> its containing block and stacking context) so it fills
// exactly the cell's padding box without needing to know the row's rendered height up front.
function withBybitRowHighlight(cols: ColumnDef<MicaExchange, any>[]): ColumnDef<MicaExchange, any>[] {
	return cols.map((column, index) => ({
		...column,
		meta: {
			...column.meta,
			cellClassName: [column.meta?.cellClassName, 'relative z-0'].filter(Boolean).join(' ')
		},
		cell: (ctx: CellContext<MicaExchange, any>) => {
			const content = flexRender(column.cell, ctx)
			if (ctx.row.original.exchange !== 'bybit') return content
			return (
				<>
					<span
						aria-hidden="true"
						className="absolute inset-0 -z-10"
						style={{
							background: 'color-mix(in oklch, var(--success) 16%, var(--bg-surface))',
							boxShadow: index === 0 ? 'inset 3px 0 0 0 color-mix(in oklch, var(--success) 85%, black 15%)' : undefined
						}}
					/>
					{content}
				</>
			)
		}
	}))
}

const HIGHLIGHTED_COLUMNS = withBybitRowHighlight(columns)

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
	const sorted = [...rows].sort(
		(a, b) =>
			(PRIORITY_EXCHANGE_RANK.get(a.exchange) ?? Infinity) - (PRIORITY_EXCHANGE_RANK.get(b.exchange) ?? Infinity) ||
			getDepthLiquidity(b) - getDepthLiquidity(a) ||
			(a.secondary ? 1 : 0) - (b.secondary ? 1 : 0) ||
			(a.spot_fee.taker ?? Infinity) - (b.spot_fee.taker ?? Infinity) ||
			a.display_name.localeCompare(b.display_name)
	)
	// ponytail: temp — force nexo into the second-to-last slot until it earns a
	// natural rank; drop this splice when nexo gets real liquidity/priority data.
	const nexoIdx = sorted.findIndex((row) => row.exchange === 'nexo')
	if (nexoIdx !== -1 && sorted.length > 1) {
		const [nexo] = sorted.splice(nexoIdx, 1)
		sorted.splice(sorted.length - 1, 0, nexo)
	}
	return sorted
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
			columns={HIGHLIGHTED_COLUMNS}
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
