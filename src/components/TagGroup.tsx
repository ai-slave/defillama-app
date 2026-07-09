import * as React from 'react'
import { SegmentedControl } from './SegmentedControl'
import type { TagGroupSize, TagGroupVariant } from './Select/types'

interface IProps<V extends readonly string[] = readonly string[]> extends React.ComponentProps<'div'> {
	selectedValue: V[number] | null
	setValue: (value: V[number]) => void
	values: V
	variant: TagGroupVariant
	size: TagGroupSize
	label?: string
	disabledValues?: readonly V[number][]
}

export function TagGroup<V extends readonly string[]>({
	selectedValue,
	setValue,
	values,
	style,
	className,
	variant,
	size,
	label,
	disabledValues,
	...props
}: IProps<V>) {
	return (
		<SegmentedControl
			value={selectedValue}
			onValueChange={setValue}
			options={values.map((value) => ({
				value,
				label: `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`,
				disabled: disabledValues?.includes(value)
			}))}
			label={label ?? 'Options'}
			leading={label}
			variant={variant}
			size={size}
			className={className}
			style={style}
			{...props}
		/>
	)
}
