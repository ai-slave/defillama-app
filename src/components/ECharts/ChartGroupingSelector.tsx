import clsx from 'clsx'
import * as React from 'react'
import { chartSegmentedControlButtonStyles, chartSegmentedControlGroupStyles } from '~/components/Select/types'
import { Tooltip } from '~/components/Tooltip'
import type { ChartTimeGrouping, ChartTimeGroupingWithCumulative } from './types'

export type ChartGroupingOption<T extends string> = {
	value: T
	label: string
	shortLabel?: string
}

export const DWMC_GROUPING_OPTIONS_LOWERCASE = [
	{ value: 'daily', label: 'Daily', shortLabel: 'D' },
	{ value: 'weekly', label: 'Weekly', shortLabel: 'W' },
	{ value: 'monthly', label: 'Monthly', shortLabel: 'M' },
	{ value: 'quarterly', label: 'Quarterly', shortLabel: 'Q' },
	{ value: 'yearly', label: 'Yearly', shortLabel: 'Y' },
	{ value: 'cumulative', label: 'Cumulative', shortLabel: 'C' }
] as const satisfies readonly ChartGroupingOption<ChartTimeGroupingWithCumulative>[]

export const DWM_GROUPING_OPTIONS_LOWERCASE = [
	{ value: 'daily', label: 'Daily', shortLabel: 'D' },
	{ value: 'weekly', label: 'Weekly', shortLabel: 'W' },
	{ value: 'monthly', label: 'Monthly', shortLabel: 'M' },
	{ value: 'quarterly', label: 'Quarterly', shortLabel: 'Q' },
	{ value: 'yearly', label: 'Yearly', shortLabel: 'Y' }
] as const satisfies readonly ChartGroupingOption<ChartTimeGrouping>[]

export type LowercaseDwmcGrouping = (typeof DWMC_GROUPING_OPTIONS_LOWERCASE)[number]['value']
export type LowercaseDwmGrouping = (typeof DWM_GROUPING_OPTIONS_LOWERCASE)[number]['value']

type BaseProps<T extends string> = {
	value: T
	options: readonly ChartGroupingOption<T>[]
	className?: string
	buttonClassName?: string
}

type LocalStateProps<T extends string> = BaseProps<T> & {
	setValue: React.Dispatch<React.SetStateAction<T>>
	onValueChange?: never
}

type ExternalStateProps<T extends string> = BaseProps<T> & {
	onValueChange: (value: T) => void
	setValue?: never
}

type ChartGroupingSelectorProps<T extends string> = LocalStateProps<T> | ExternalStateProps<T>

export function ChartGroupingSelector<T extends string>({
	value,
	options,
	className,
	buttonClassName,
	...props
}: ChartGroupingSelectorProps<T>) {
	const handleValueChange = React.useCallback(
		(nextValue: T) => {
			if ('setValue' in props) {
				React.startTransition(() => props.setValue(nextValue))
				return
			}

			props.onValueChange(nextValue)
		},
		[props]
	)

	return (
		<div role="radiogroup" className={clsx(chartSegmentedControlGroupStyles, className)}>
			{options.map((option) => {
				const shortLabel = option.shortLabel ?? option.label.slice(0, 1).toUpperCase()
				return (
					<Tooltip content={option.label} key={option.value}>
						<button
							type="button"
							role="radio"
							aria-checked={value === option.value}
							aria-label={option.label}
							className={clsx(chartSegmentedControlButtonStyles, buttonClassName)}
							data-active={value === option.value}
							onClick={() => handleValueChange(option.value)}
						>
							{shortLabel}
						</button>
					</Tooltip>
				)
			})}
		</div>
	)
}
