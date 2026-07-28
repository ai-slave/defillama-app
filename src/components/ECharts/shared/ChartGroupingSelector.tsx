import * as React from 'react'
import { SegmentedControl } from '~/ui/SegmentedControl'
import type { ChartTimeGrouping, ChartTimeGroupingWithCumulative } from '../MultiSeriesChart/types'

export type ChartGroupingOption<T extends string> = {
	value: T
	label: string
	shortLabel?: string
	tooltip?: React.ReactNode
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
	className?: string | undefined
	buttonClassName?: string | undefined
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
			if (props.setValue) {
				React.startTransition(() => props.setValue(nextValue))
				return
			}

			props.onValueChange(nextValue)
		},
		[props]
	)
	const styleProps: { className?: string; buttonClassName?: string } = {}
	if (className !== undefined) styleProps.className = className
	if (buttonClassName !== undefined) styleProps.buttonClassName = buttonClassName

	return (
		<SegmentedControl
			value={value}
			onValueChange={handleValueChange}
			options={options.map((option) => ({
				value: option.value,
				label: option.shortLabel ?? option.label.slice(0, 1).toUpperCase(),
				ariaLabel: option.label,
				tooltip: option.tooltip ?? option.label
			}))}
			label="Chart grouping"
			variant="default"
			size="md"
			{...styleProps}
		/>
	)
}
