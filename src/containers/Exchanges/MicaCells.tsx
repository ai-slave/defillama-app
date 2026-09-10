import * as Ariakit from '@ariakit/react'
import { Icon } from '~/ui/Icon'
import { popoverHovercardSurfaceStyles } from '~/ui/Popover'
import { Tooltip } from '~/ui/Tooltip'
import { formatPercent, formatUsd, formatNumber } from '~/utils/numberFormat'
import type { ExchangePromotionModel, MicaProduct, MicaVenueModel } from './models'
import { promotionLinks } from './promotions'
import { btcAmount, Breakdown, CostBadge, LEG_TONE_LIMITS } from './RampCells'

function liquidity(value: number): string {
	return formatUsd(value, { compact: true }) ?? '–'
}

export function supportsMicaProduct(row: MicaVenueModel, product: 'spot' | 'perp'): boolean {
	return row.products.includes(product === 'perp' ? 'linear_perp' : product)
}

const MICA_PRODUCT_LABELS: Record<MicaProduct, string> = {
	spot: 'Spot',
	margin: 'Margin',
	linear_perp: 'Perps',
	inverse_perp: 'COIN perps',
	futures: 'Futures',
	options: 'Options'
}

export function micaProductLabel(products: Array<MicaProduct>): string {
	return products.map((product) => MICA_PRODUCT_LABELS[product]).join(' · ')
}

export function micaDepthDetail(bid: number | null, ask: number | null, partialCoverage: boolean): string | null {
	if (bid == null || ask == null) return null
	return [`${liquidity(bid)} bid`, `${liquidity(ask)} ask`, partialCoverage ? 'Partial coverage' : null]
		.filter(Boolean)
		.join('\n')
}

export function MicaDepthValue({
	row,
	product,
	value,
	bid,
	ask,
	helperText
}: {
	row: MicaVenueModel
	product: 'spot' | 'perp'
	value: number | undefined
	bid: number | null
	ask: number | null
	helperText: string
}) {
	if (!supportsMicaProduct(row, product)) return <span className="text-tertiary">N/A</span>
	if (value == null || bid == null || ask == null) return <span className="text-tertiary">–</span>
	const partialCoverage = product === 'spot' ? row.depth.spotPartialCoverage : row.depth.perpPartialCoverage
	const detail = micaDepthDetail(bid, ask, partialCoverage)
	return (
		<span className="inline-flex items-center justify-end gap-1.5">
			<Tooltip content={detail} className="justify-end whitespace-nowrap">
				{liquidity(value)}
			</Tooltip>
			<Tooltip content={helperText}>
				<Icon name="help-circle" height={13} width={13} className="shrink-0 text-tertiary" />
			</Tooltip>
		</span>
	)
}

export const SPOT_DEPTH_2_HELP =
	'Bid plus ask depth within 2% of mid across the venue’s spot markets, from our own order-book snapshots, never venue-reported.'
export const SPOT_DEPTH_05_HELP =
	'Bid plus ask depth within 0.5% of mid across the venue’s spot markets, from our own order-book snapshots. Closest to executable liquidity at the touch.'
export const PERP_DEPTH_2_HELP =
	'Bid plus ask depth within 2% of mid across the venue’s perpetual markets, from our own order-book snapshots, never venue-reported.'
export const PERP_DEPTH_05_HELP =
	'Bid plus ask depth within 0.5% of mid across the venue’s perpetual markets, from our own order-book snapshots. Closest to executable liquidity at the touch.'
export const ON_RAMP_COST_HELP =
	'Total cost to turn €1,000 into BTC in your own wallet: SEPA deposit + taker fee + orderbook slippage + BTC withdrawal fee. Hover for the full breakdown.'
export const OFF_RAMP_COST_HELP =
	'Total cost to turn €1,000 of BTC into EUR in your bank account: BTC network fee + taker fee + orderbook slippage + SEPA withdrawal. Hover for the full breakdown.'

function cleanPromotionSubtitle(promotion: ExchangePromotionModel) {
	return promotion.subtitle?.replace(/\s*T&Cs apply\.?$/i, '').trim()
}

export function PromotionGift({ promotion, venue }: { promotion: ExchangePromotionModel; venue: MicaVenueModel }) {
	const links = promotionLinks(promotion)
	const subtitle = cleanPromotionSubtitle(promotion)
	const hasTerms = Boolean(promotion.termsUrl || /\s*T&Cs apply\.?$/i.test(promotion.subtitle ?? ''))

	return (
		<Ariakit.HovercardProvider placement="right-start" showTimeout={0} hideTimeout={50}>
			<Ariakit.HovercardAnchor
				render={<button type="button" />}
				type="button"
				className="hover-wash inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-subtle bg-surface text-secondary hover:border-strong hover:text-primary focus-visible:border-strong focus-visible:text-primary"
				aria-label={`${venue.name} promotion: ${promotion.label}`}
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
						{promotion.endsAt ? <span>Ends {promotion.endsAt}</span> : null}
						{hasTerms ? <span>T&amp;Cs apply</span> : null}
					</span>
				</span>
				{links.length > 0 ? (
					<span className="flex flex-col border-t border-subtle">
						{links.map((link) => (
							<a
								key={`${link.label}:${link.href}`}
								href={link.href}
								target="_blank"
								rel="noopener noreferrer"
								data-umami-event="mica-promotion-click"
								data-umami-event-exchange={venue.exchange}
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

type RampDirection = 'onRamp' | 'offRamp'

const RAMP_DIRECTION_STEPS: Record<RampDirection, string> = {
	onRamp: 'Deposit EUR (SEPA) → buy BTC → withdraw to your wallet',
	offRamp: 'Deposit BTC → sell → withdraw EUR (SEPA)'
}

function formatEur(value: number | null): string | null {
	return value == null
		? null
		: formatNumber(value, { currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Same badge and breakdown the /ramp table uses, priced in EUR on the SEPA rail. */
export function RampCostValue({ row, direction }: { row: MicaVenueModel; direction: RampDirection }) {
	const cost = row.rampCost
	if (!cost) return <span className="text-tertiary">–</span>
	const leg = cost[direction]
	if (leg.totalUsd == null) return <span className="text-tertiary">–</span>
	const transferBtc = btcAmount(
		direction === 'onRamp' ? cost.assumptions.btcWithdrawalFeeBtc : cost.assumptions.btcNetworkFeeBtc
	)
	const notional = formatNumber(cost.notionalUsd, { currency: 'EUR', maximumFractionDigits: 0 })
	return (
		<CostBadge
			label={formatEur(leg.totalUsd) ?? '–'}
			fraction={leg.totalFraction}
			limits={LEG_TONE_LIMITS}
			ariaLabel={`${row.name} ${notional} ${direction === 'onRamp' ? 'on-ramp' : 'off-ramp'} cost breakdown`}
		>
			<Breakdown
				steps={RAMP_DIRECTION_STEPS[direction]}
				scope={`${notional} notional on ${cost.pair ?? '–'}`}
				rows={[
					{ label: `SEPA ${direction === 'onRamp' ? 'deposit' : 'withdrawal'}`, value: formatEur(leg.fiatFeeUsd) },
					{
						label:
							cost.assumptions.takerFee == null
								? 'Taker fee'
								: `Taker fee (${formatPercent(cost.assumptions.takerFee, { input: 'fraction' })})`,
						value: formatEur(leg.tradeFeeUsd)
					},
					{ label: 'Slippage vs mid price', value: formatEur(leg.slippageUsd) },
					{
						label:
							direction === 'onRamp'
								? `BTC withdrawal fee${transferBtc ? ` (${transferBtc})` : ''}`
								: `BTC network fee${transferBtc ? ` (${transferBtc})` : ''}`,
						value: formatEur(leg.transferFeeUsd)
					}
				]}
				total={formatEur(leg.totalUsd)}
				totalFraction={leg.totalFraction}
			/>
		</CostBadge>
	)
}
