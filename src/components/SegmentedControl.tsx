import clsx from 'clsx'
import * as React from 'react'
import { Tooltip } from '~/ui/Tooltip'
import { TAG_GROUP_SIZES, TAG_GROUP_VARIANTS, type TagGroupSize, type TagGroupVariant } from './Select/types'

export type SegmentedControlOption<T extends string> = {
	value: T
	label: React.ReactNode
	ariaLabel?: string
	disabled?: boolean
	tooltip?: React.ReactNode
}

type SegmentedControlProps<T extends string> = Omit<React.ComponentProps<'div'>, 'children' | 'onChange'> & {
	value: T | null
	onValueChange: (value: T) => void
	options: readonly SegmentedControlOption<T>[]
	label: string
	leading?: React.ReactNode
	variant: TagGroupVariant
	size: TagGroupSize
	className?: string
	buttonClassName?: string
}

/** A single-choice control with radio semantics and a roving tab stop. */
export function SegmentedControl<T extends string>({
	value,
	onValueChange,
	options,
	label,
	leading,
	variant,
	size,
	className,
	buttonClassName,
	...props
}: SegmentedControlProps<T>) {
	const { container, button } = TAG_GROUP_VARIANTS[variant]
	const refs = React.useRef<Array<HTMLButtonElement | null>>([])
	const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled)
	const tabStopIndex = selectedIndex >= 0 ? selectedIndex : options.findIndex((option) => !option.disabled)

	const selectAt = React.useCallback(
		(index: number) => {
			const option = options[index]
			if (!option || option.disabled) return
			onValueChange(option.value)
			refs.current[index]?.focus()
		},
		[onValueChange, options]
	)

	const move = React.useCallback(
		(start: number, direction: 1 | -1) => {
			for (let offset = 1; offset <= options.length; offset++) {
				const index = (start + direction * offset + options.length) % options.length
				if (!options[index].disabled) {
					selectAt(index)
					return
				}
			}
		},
		[options, selectAt]
	)

	return (
		<div role="radiogroup" aria-label={label} className={clsx(container, TAG_GROUP_SIZES[size], className)} {...props}>
			{leading ? <span className="pr-1 pl-3">{leading}</span> : null}
			{options.map((option, index) => {
				const control = (
					<button
						ref={(element) => {
							refs.current[index] = element
						}}
						type="button"
						role="radio"
						aria-checked={option.value === value}
						aria-label={option.ariaLabel}
						tabIndex={index === tabStopIndex ? 0 : -1}
						disabled={option.disabled}
						className={clsx(button, buttonClassName)}
						data-active={option.value === value}
						onClick={() => onValueChange(option.value)}
						onKeyDown={(event) => {
							if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
								event.preventDefault()
								move(index, 1)
							} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
								event.preventDefault()
								move(index, -1)
							} else if (event.key === 'Home') {
								event.preventDefault()
								selectAt(options.findIndex((item) => !item.disabled))
							} else if (event.key === 'End') {
								event.preventDefault()
								selectAt(options.findLastIndex((item) => !item.disabled))
							}
						}}
					>
						{option.label}
					</button>
				)

				return (
					<React.Fragment key={option.value}>
						{option.tooltip ? <Tooltip content={option.tooltip}>{control}</Tooltip> : control}
					</React.Fragment>
				)
			})}
		</div>
	)
}
