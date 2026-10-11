import { Button } from '~/ui/Button'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { Tooltip } from '~/ui/Tooltip'
import { formatPercent, formatUsd, formatNumber } from '~/utils/numberFormat'
import type { ExchangePromotionModel, MicaVenueModel } from './models'
import { promotionLinks } from './promotions'
import { btcAmount, Breakdown, CostBadge, LEG_TONE_LIMITS } from './RampCells'

// Every ramp-cost field on the model is USD (`totalUsd`, `fiatFeeUsd`, …): the
// backend converts the EUR fiat leg at the build's EUR/USD rate and prices the
// trade and transfer legs in USD from the start. This used to be `currency: 'EUR'`,
// which stamped a € on USD figures and overstated them by the FX rate. The RAIL is
// still EUR/SEPA — that belongs in the step text, not in the number's symbol.
// Matches USD_FIXED_OPTIONS in RampCells.tsx, which formats the same fields.
const USD_FIXED_OPTIONS = { currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 } as const

export function supportsMicaProduct(row: MicaVenueModel, product: 'spot' | 'perp'): boolean {
	return row.products.includes(product === 'perp' ? 'linear_perp' : product)
}

export function micaDepthDetail(
	row: MicaVenueModel,
	product: 'spot' | 'perp',
	bid: number | null,
	ask: number | null
): string | null {
	if (bid == null || ask == null) return null
	const partialCoverage = product === 'spot' ? row.depth.spotPartialCoverage : row.depth.perpPartialCoverage
	return [
		`${formatUsd(bid, { compact: true }) ?? '–'} bid`,
		`${formatUsd(ask, { compact: true }) ?? '–'} ask`,
		partialCoverage ? 'Partial coverage' : null
	]
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
	const detail = micaDepthDetail(row, product, bid, ask)
	return (
		<span className="inline-flex items-center justify-end gap-1.5">
			<Tooltip content={detail} className="justify-end whitespace-nowrap">
				{formatUsd(value, { compact: true }) ?? '–'}
			</Tooltip>
			<QuestionHelper text={helperText} />
		</span>
	)
}

export const SPOT_DEPTH_2_HELP =
	'Bid plus ask depth within 2% of mid across spot markets, from our own snapshots, never venue-reported.'
export const SPOT_DEPTH_05_HELP =
	'Same across spot markets, but within 0.5% of mid: closest to what is executable at the touch.'
export const PERP_DEPTH_2_HELP =
	'Bid plus ask depth within 2% of mid across perp markets, from our own snapshots, never venue-reported.'
export const PERP_DEPTH_05_HELP =
	'Same across perp markets, but within 0.5% of mid: closest to what is executable at the touch.'
// Costs are USD. The notional is $1,000 and the fiat leg is the EUR SEPA rail,
// converted at the build's EUR/USD rate — so the amount is dollars even though the
// rail is euros. These read "€1,000" before, which described neither.
export const ON_RAMP_COST_HELP =
	'Cost of turning $1,000 into BTC in your own wallet via EUR SEPA: deposit + taker fee + slippage + BTC withdrawal. Hover for the breakdown.'
export const OFF_RAMP_COST_HELP =
	'Cost of turning $1,000 of BTC into EUR in your bank account: network fee + taker fee + slippage + SEPA withdrawal. Hover for the breakdown.'

function cleanPromotionSubtitle(promotion: ExchangePromotionModel) {
	return promotion.subtitle?.replace(/\s*T&Cs apply\.?$/i, '').trim()
}

export function PromotionGift({ promotion, venue }: { promotion: ExchangePromotionModel; venue: MicaVenueModel }) {
	const links = promotionLinks(promotion)
	const subtitle = cleanPromotionSubtitle(promotion)
	const hasTerms = Boolean(promotion.termsUrl || /\s*T&Cs apply\.?$/i.test(promotion.subtitle ?? ''))

	return (
		<Hovercard
			placement="right-start"
			render={<Button size="md" square aria-label={`${venue.name} promotion: ${promotion.label}`} />}
			contentClassName="w-72 overflow-hidden p-0"
			content={
				<>
					<span className="flex flex-col gap-3 p-3">
						<span className="flex items-start gap-2">
							<span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-subtle bg-surface text-secondary">
								<Icon name="gift" className="size-3.5" />
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
									<Icon name="gift" className="size-3 shrink-0 text-link" />
									<span>{link.label}</span>
									<Icon name="arrow-up-right" className="ml-auto size-3 shrink-0 text-tertiary" />
								</a>
							))}
						</span>
					) : null}
				</>
			}
		>
			<Icon name="gift" className="size-4" />
		</Hovercard>
	)
}

type RampDirection = 'onRamp' | 'offRamp'

const RAMP_DIRECTION_STEPS: Record<RampDirection, string> = {
	onRamp: 'Deposit EUR (SEPA) → buy BTC → withdraw to your wallet',
	offRamp: 'Deposit BTC → sell → withdraw EUR (SEPA)'
}

/** Same badge and breakdown the /ramp table uses. Amounts are USD; the rail priced
 *  is EUR SEPA (see RAMP_DIRECTION_STEPS) — /mica deliberately compares every venue
 *  on that one rail, unlike /ramps and the directory which take the cheapest. */
export function RampCostValue({ row, direction }: { row: MicaVenueModel; direction: RampDirection }) {
	const cost = row.rampCost
	if (!cost) return <span className="text-tertiary">–</span>
	const leg = cost[direction]
	if (leg.totalUsd == null) return <span className="text-tertiary">–</span>
	const transferBtc = btcAmount(
		direction === 'onRamp' ? cost.assumptions.btcWithdrawalFeeBtc : cost.assumptions.btcNetworkFeeBtc
	)
	const notional = formatNumber(cost.notionalUsd, { currency: 'USD', maximumFractionDigits: 0 })
	return (
		<CostBadge
			label={formatNumber(leg.totalUsd, USD_FIXED_OPTIONS) ?? '–'}
			fraction={leg.totalFraction}
			limits={LEG_TONE_LIMITS}
			ariaLabel={`${row.name} ${notional} ${direction === 'onRamp' ? 'on-ramp' : 'off-ramp'} cost breakdown`}
		>
			<Breakdown
				steps={RAMP_DIRECTION_STEPS[direction]}
				scope={`${notional} notional on ${cost.pair ?? '–'}`}
				rows={[
					{
						label: `SEPA ${direction === 'onRamp' ? 'deposit' : 'withdrawal'}`,
						value: formatNumber(leg.fiatFeeUsd, USD_FIXED_OPTIONS)
					},
					{
						label:
							cost.assumptions.takerFee == null
								? 'Taker fee'
								: `Taker fee (${formatPercent(cost.assumptions.takerFee, { input: 'fraction' })})`,
						value: formatNumber(leg.tradeFeeUsd, USD_FIXED_OPTIONS)
					},
					{ label: 'Slippage vs mid price', value: formatNumber(leg.slippageUsd, USD_FIXED_OPTIONS) },
					{
						label:
							direction === 'onRamp'
								? `BTC withdrawal fee${transferBtc ? ` (${transferBtc})` : ''}`
								: `BTC network fee${transferBtc ? ` (${transferBtc})` : ''}`,
						value: formatNumber(leg.transferFeeUsd, USD_FIXED_OPTIONS)
					}
				]}
				total={formatNumber(leg.totalUsd, USD_FIXED_OPTIONS)}
				totalFraction={leg.totalFraction}
			/>
		</CostBadge>
	)
}
