import type { ReactNode } from 'react'
import { Tooltip } from '~/ui/Tooltip'
import {
	formatCompactNumber,
	formatNumber,
	formatPercentChange,
	formatUsd,
	NUMBER_LOWERCASE_MILLIONS_OPTIONS,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'

/* ----------------------------------------------------------------------------
   Change: a signed movement, colored by its direction.

   <Change value={-2.2} />                       -2.20%, in a table cell or row
   <Change value={52_100_000} unit="usd" />      +$52.1m
   <Change value={123} unit="count" />           +123
   <Change value={-0.12} unit="pp" />            -0.12pp
   <Change value={1.4} tooltip="+$2.1b" />       the same movement in another unit, on hover

   Change owns the sign, the format and the color: up is text-data-up, down
   text-data-down, zero takes its container's color. Never color a movement
   by hand (policy: hand-colored-change); a headline, tile, strip or small
   card takes its change as `{ value, unit, comparison }` data and draws it
   through Change with the window beside it. A change with no earlier value
   is left out: the container shows nothing there, never a "no prior" state.
   The type comes from the container. formatChange is for text Change can't render (an aria label, a
   chart tooltip string); changeTone for an HTML string.

   A signed value that is not a movement (a funding rate, a share of a total)
   is not a Change. A peg deviation, a perp premium or a funding rate is a
   neutral signed number (formatPercentChange), and a funding rate says who
   pays, in its tooltip or beside the value where it has none.
---------------------------------------------------------------------------- */

type ChangeUnit = 'percent' | 'usd' | 'count' | 'pp'

/** A headline's change as data: the container draws the value through Change and the window beside it. */
export interface ChangeData {
	value: number
	unit?: ChangeUnit
	/** The window, worded from the metric's definition: "over 24h", or "vs 24h ago" for a rolling value. */
	comparison: string
	/** The same movement in another unit, such as the dollar change. */
	tooltip?: ReactNode
}

export function formatChange(value: number, unit: ChangeUnit = 'percent'): string {
	switch (unit) {
		case 'percent':
			return formatPercentChange(value)
		case 'usd':
			return formatUsd(value, { ...USD_LOWERCASE_MILLIONS_OPTIONS, signDisplay: 'exceptZero' })
		case 'count':
			return formatCompactNumber(value, { ...NUMBER_LOWERCASE_MILLIONS_OPTIONS, signDisplay: 'exceptZero' })
		case 'pp':
			return `${formatNumber(value, { signDisplay: 'exceptZero', minimumFractionDigits: 2, maximumFractionDigits: 2 })}pp`
	}
}

export function changeTone(value: number): string {
	return value > 0 ? 'text-data-up' : value < 0 ? 'text-data-down' : ''
}

/** A missing value renders nothing, so a nullable column passes its value as is. */
export function Change({
	value,
	unit = 'percent',
	tooltip
}: {
	value: number | null | undefined
	unit?: ChangeUnit
	tooltip?: ReactNode
}) {
	if (value == null) return null
	const tone = changeTone(value)

	return tooltip ? (
		<Tooltip
			content={tooltip}
			render={<span />}
			tabIndex={0}
			className={`cursor-help underline decoration-dotted underline-offset-4 ${tone}`.trim()}
		>
			{formatChange(value, unit)}
		</Tooltip>
	) : (
		<span className={tone || undefined}>{formatChange(value, unit)}</span>
	)
}
