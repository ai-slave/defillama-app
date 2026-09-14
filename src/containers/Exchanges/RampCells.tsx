import * as Ariakit from '@ariakit/react'
import { popoverHovercardSurfaceStyles } from '~/ui/Popover'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import { FEE_TONE_CLASS, type FeeTone } from './feePresentation'
import type { RampRowModel } from './rampPresentation'

const USD_FIXED_OPTIONS = { currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 } as const

const DASH = <span className="text-tertiary">–</span>

/** Single-leg tone bands, shared with the /mica ramp columns; round trip is one leg each way. */
export const LEG_TONE_LIMITS = { low: 0.005, medium: 0.01 }
const ROUND_TRIP_TONE_LIMITS = { low: 0.01, medium: 0.02 }

function tone(fraction: number | null, limits: { low: number; medium: number }): FeeTone | null {
	if (fraction == null) return null
	if (fraction <= limits.low) return 'low'
	if (fraction <= limits.medium) return 'medium'
	return 'high'
}

/** Shared with the /mica ramp columns. */
export function btcAmount(value: number | null): string | null {
	return value == null ? null : `${formatNumber(value, { maximumFractionDigits: 8 })} BTC`
}

export function CostBadge({
	label,
	fraction,
	limits,
	children,
	ariaLabel
}: {
	label: string
	fraction: number | null
	limits: { low: number; medium: number }
	children: React.ReactNode
	ariaLabel: string
}) {
	const badgeTone = tone(fraction, limits)
	return (
		<Ariakit.HovercardProvider placement="left-start" showTimeout={0} hideTimeout={80}>
			<Ariakit.HovercardAnchor
				render={<button type="button" />}
				type="button"
				className={`inline-flex rounded-md border px-2 py-0.5 label-sm whitespace-nowrap ${badgeTone ? FEE_TONE_CLASS[badgeTone] : 'border-subtle text-primary'}`}
				aria-label={ariaLabel}
			>
				{label}
			</Ariakit.HovercardAnchor>
			<Ariakit.Hovercard
				unmountOnHide
				gutter={6}
				overflowPadding={16}
				className={`${popoverHovercardSurfaceStyles} w-80 p-3 text-primary`}
				portal
			>
				{children}
			</Ariakit.Hovercard>
		</Ariakit.HovercardProvider>
	)
}

export function Breakdown({
	steps,
	scope,
	rows,
	total,
	totalFraction
}: {
	steps: string
	scope: string
	rows: Array<{ label: string; value: string | null }>
	total: string | null
	totalFraction: number | null
}) {
	return (
		<div className="flex flex-col gap-2">
			<span className="body-sm text-secondary">{steps}</span>
			<span className="label-sm text-tertiary">{scope}</span>
			<span className="flex flex-col gap-1 border-t border-subtle pt-2">
				{rows.map(({ label, value }) => (
					<span key={label} className="flex items-baseline justify-between gap-3 body-sm">
						<span className="text-secondary">{label}</span>
						<span className={value == null ? 'text-tertiary' : 'text-primary'}>{value ?? 'unknown'}</span>
					</span>
				))}
			</span>
			<span className="flex items-baseline justify-between gap-3 border-t border-subtle pt-2 label-md">
				<span>Total</span>
				<span>
					{total ?? 'unavailable'}
					{totalFraction == null ? null : (
						<span className="text-tertiary"> ({formatPercent(totalFraction, { input: 'fraction' })})</span>
					)}
				</span>
			</span>
		</div>
	)
}

export function RampLegValue({
	row,
	direction,
	size
}: {
	row: RampRowModel
	direction: 'onRamp' | 'offRamp'
	size: number
}) {
	const cost = row.cost
	const leg = cost?.[direction]
	if (!cost || !leg || leg.totalUsd == null) return DASH
	const { takerFee, btcWithdrawalFeeBtc, btcNetworkFeeBtc } = row.variant.assumptions
	const rail = direction === 'onRamp' ? cost.onRail : cost.offRail
	const transferBtc = btcAmount(direction === 'onRamp' ? btcWithdrawalFeeBtc : btcNetworkFeeBtc)
	const rows = [
		{ label: `${rail ?? 'Fiat rail'} (${cost.currency})`, value: formatNumber(leg.fiatFeeUsd, USD_FIXED_OPTIONS) },
		{
			label: takerFee == null ? 'Taker fee' : `Taker fee (${formatPercent(takerFee, { input: 'fraction' })})`,
			value: formatNumber(leg.tradeFeeUsd, USD_FIXED_OPTIONS)
		},
		{ label: 'Book slippage vs mid', value: formatNumber(leg.slippageUsd, USD_FIXED_OPTIONS) },
		{
			label:
				direction === 'onRamp'
					? `BTC withdrawal fee${transferBtc ? ` (${transferBtc})` : ''}`
					: `BTC network fee${transferBtc ? ` (${transferBtc})` : ''}`,
			value: formatNumber(leg.transferFeeUsd, USD_FIXED_OPTIONS)
		}
	]
	return (
		<span className="inline-flex items-center justify-end whitespace-nowrap">
			<CostBadge
				label={formatNumber(leg.totalUsd, USD_FIXED_OPTIONS) ?? '–'}
				fraction={leg.totalFraction}
				limits={LEG_TONE_LIMITS}
				ariaLabel={`${row.name} ${direction === 'onRamp' ? 'on-ramp' : 'off-ramp'} cost breakdown`}
			>
				<Breakdown
					steps={
						direction === 'onRamp'
							? `Deposit ${cost.currency} → buy BTC → withdraw to your own wallet`
							: `Deposit BTC → sell → withdraw ${cost.currency}`
					}
					scope={`${formatUsd(size, { maximumFractionDigits: 0 })} on ${cost.pair ?? '–'}`}
					rows={rows}
					total={formatNumber(leg.totalUsd, USD_FIXED_OPTIONS)}
					totalFraction={leg.totalFraction}
				/>
			</CostBadge>
		</span>
	)
}

export function RampRoundTripValue({ row, size }: { row: RampRowModel; size: number }) {
	if (row.roundTripUsd == null || !row.cost) return DASH
	return (
		<span className="inline-flex items-center justify-end whitespace-nowrap">
			<CostBadge
				label={formatNumber(row.roundTripUsd, USD_FIXED_OPTIONS) ?? '–'}
				fraction={row.roundTripFraction}
				limits={ROUND_TRIP_TONE_LIMITS}
				ariaLabel={`${row.name} round-trip cost breakdown`}
			>
				<Breakdown
					steps={`In and back out: ${row.cost.currency} → BTC → your wallet, then wallet → BTC → ${row.cost.currency}`}
					scope={`${formatUsd(size, { maximumFractionDigits: 0 })} each way on ${row.cost.pair ?? '–'}`}
					rows={[
						{ label: 'On-ramp', value: formatNumber(row.cost.onRamp.totalUsd, USD_FIXED_OPTIONS) },
						{ label: 'Off-ramp', value: formatNumber(row.cost.offRamp.totalUsd, USD_FIXED_OPTIONS) }
					]}
					total={formatNumber(row.roundTripUsd, USD_FIXED_OPTIONS)}
					totalFraction={row.roundTripFraction}
				/>
			</CostBadge>
		</span>
	)
}

export function RampTradeValue({ row, size }: { row: RampRowModel; size: number }) {
	if (row.tradeCostUsd == null || !row.trade) return DASH
	const { takerFee } = row.variant.assumptions
	const detail = [
		`Execution only: no fiat rail, no transfer.`,
		`${formatUsd(size, { maximumFractionDigits: 0 })} market buy on ${row.trade.pair ?? '–'}`,
		`Taker fee${takerFee == null ? '' : ` (${formatPercent(takerFee, { input: 'fraction' })})`}: ${formatNumber(row.trade.tradeFeeUsd, USD_FIXED_OPTIONS) ?? 'unknown'}`,
		`Book slippage: ${formatNumber(row.trade.slippageBuyUsd, USD_FIXED_OPTIONS) ?? 'unknown'}`
	].join('\n')
	return (
		<Tooltip content={detail} className="justify-end whitespace-nowrap">
			{formatNumber(row.tradeCostUsd, USD_FIXED_OPTIONS)}
		</Tooltip>
	)
}

export function RampCurrenciesValue({ row, currency }: { row: RampRowModel; currency: string | null }) {
	const currencies = row.variant.fiatCurrencies
	if (currencies.length === 0) return DASH
	const supported = currency !== null && currencies.includes(currency)
	return (
		<Tooltip content={currencies.join(', ')} className="justify-end">
			<span className={`whitespace-nowrap ${supported ? 'text-primary' : 'text-secondary'}`}>
				{currencies.length}
				{supported ? ' ✓' : ''}
			</span>
		</Tooltip>
	)
}

const ACCESS_LABEL: Record<RampRowModel['status'], { label: string; tone: FeeTone; description: string }> = {
	available: { label: 'Available', tone: 'low', description: 'Open to users in the selected country.' },
	restricted: {
		label: 'Restricted',
		tone: 'medium',
		description: 'Declared restrictions apply in the selected country.'
	},
	leaving: { label: 'Leaving', tone: 'medium', description: 'The venue is winding down service in this market.' },
	unavailable: {
		label: 'Unavailable',
		tone: 'high',
		description: 'The venue’s own terms or geo-gate exclude this country.'
	}
}

/** Status for the selected country, plus the venue's own note and whether its
 *  global record had to stand in for a country-specific one. */
export function RampAccessValue({ row, country }: { row: RampRowModel; country: string | null }) {
	const presentation = ACCESS_LABEL[row.status]
	const detail = [
		presentation.description,
		row.note,
		country && row.usedFallback ? 'No record for this region, so the venue’s global terms apply.' : null
	]
		.filter(Boolean)
		.join('\n')
	return (
		<Tooltip content={detail}>
			<span
				className={`inline-flex h-[18px] items-center rounded-sm border px-1.5 label-sm ${FEE_TONE_CLASS[presentation.tone]}`}
			>
				{presentation.label}
			</span>
		</Tooltip>
	)
}
