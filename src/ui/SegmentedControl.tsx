import clsx from 'clsx'
import * as React from 'react'
import { Tooltip } from './Tooltip'

/* Two selection controls in the design system — do not conflate:
   - default/responsive = the padded, tinted segmented control for periods,
     denominations, and view modes.
   - solid = the compact joined toggle group with a solid brand selection for
     explicit scope switches such as All | Protocols | Chains. */
export const TAG_GROUP_VARIANTS = {
	default: {
		container:
			'body-sm flex w-fit flex-nowrap items-center gap-0.5 overflow-x-auto rounded-lg border border-medium bg-surface p-0.5',
		button:
			'hover-wash shrink-0 rounded-md px-2 py-1 whitespace-nowrap text-secondary hover:text-primary data-[active=true]:bg-brand-muted data-[active=true]:text-link-on-tint'
	},
	chips: {
		container: 'flex w-fit max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto',
		button:
			'hover-wash shrink-0 rounded-full border border-medium px-3 py-1.5 label-sm whitespace-nowrap text-primary hover:border-brand focus-visible:border-brand data-[active=true]:border-brand data-[active=true]:bg-brand-muted data-[active=true]:text-link-on-tint'
	},
	responsive: {
		container:
			'body-sm flex w-fit flex-nowrap items-center gap-0.5 overflow-x-auto rounded-lg border border-medium bg-surface p-0.5 max-sm:w-full',
		button:
			'hover-wash inline-flex max-sm:flex-1 items-center justify-center shrink-0 rounded-md px-2 py-1 whitespace-nowrap text-secondary hover:text-primary data-[active=true]:bg-brand-muted data-[active=true]:text-link-on-tint'
	},
	solid: {
		container: 'body-sm flex w-fit flex-nowrap items-center overflow-hidden rounded-md border border-subtle',
		button:
			'hover-wash shrink-0 self-stretch px-2 whitespace-nowrap text-primary data-[active=true]:bg-brand data-[active=true]:text-on-brand'
	},
	'solid-responsive': {
		container:
			'body-sm flex w-fit flex-nowrap items-center overflow-hidden rounded-md border border-subtle max-sm:w-full',
		button:
			'hover-wash inline-flex max-sm:flex-1 items-center justify-center shrink-0 self-stretch px-2 whitespace-nowrap text-primary data-[active=true]:bg-brand data-[active=true]:text-on-brand'
	},
	pro: {
		container: 'text-sm flex items-center overflow-x-auto flex-nowrap w-fit border pro-border text-pro-text-primary',
		button:
			'shrink-0 px-3 py-1.5 whitespace-nowrap hover:pro-panel-raised focus-visible:pro-panel-raised data-[active=true]:bg-brand data-[active=true]:text-on-brand'
	}
} as const

/* Chart/table toolbar contexts are md (32px); dense gaps come from Toolbar. */
export const TAG_GROUP_SIZES = {
	sm: 'min-h-6',
	md: 'min-h-8'
} as const

export const chartSegmentedControlGroupStyles = `${TAG_GROUP_VARIANTS.default.container} ${TAG_GROUP_SIZES.md}`
export const chartSegmentedControlButtonStyles = TAG_GROUP_VARIANTS.default.button

export type TagGroupSize = keyof typeof TAG_GROUP_SIZES
export type TagGroupVariant = keyof typeof TAG_GROUP_VARIANTS

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
	options: ReadonlyArray<SegmentedControlOption<T>>
	label: string
	leading?: React.ReactNode
	variant: TagGroupVariant
	size: TagGroupSize
	className?: string
	buttonClassName?: string
	/**
	 * `radio` (default) is for choosing a *value* that reconfigures one region —
	 * a period, a denomination, a grouping. `tabs` is for switching between
	 * distinct content panels, and requires `panelIdPrefix`: each option is then
	 * a tab that names and points at its own panel, so assistive tech can tell
	 * that the region below changed and can jump straight to it.
	 */
	semantics?: 'radio' | 'tabs'
	/** Required by `semantics="tabs"`. See {@link segmentedControlTabIds}. */
	panelIdPrefix?: string
}

/** Wires a tabs-semantics control to its panel: the panel element must carry
    `role="tabpanel"`, `id={panelId}` and `aria-labelledby={tabId}` for the
    option it renders. Ids are derived, so caller and control cannot drift. */
export function segmentedControlTabIds(panelIdPrefix: string, value: string) {
	return { tabId: `${panelIdPrefix}-tab-${value}`, panelId: `${panelIdPrefix}-panel-${value}` }
}

/** A single-choice control with a roving tab stop, in radio or tab semantics. */
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
	semantics = 'radio',
	panelIdPrefix,
	...props
}: SegmentedControlProps<T>) {
	if (semantics === 'tabs' && panelIdPrefix == null) {
		throw new Error('SegmentedControl: semantics="tabs" requires panelIdPrefix')
	}
	const isTabs = semantics === 'tabs'
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
		<div
			role={isTabs ? 'tablist' : 'radiogroup'}
			aria-label={label}
			className={clsx(container, TAG_GROUP_SIZES[size], className)}
			{...props}
		>
			{leading ? <span className="pr-1 pl-3">{leading}</span> : null}
			{options.map((option, index) => {
				const isSelected = option.value === value
				const ids = isTabs ? segmentedControlTabIds(panelIdPrefix as string, option.value) : null
				const control = (
					<button
						ref={(element) => {
							refs.current[index] = element
						}}
						type="button"
						role={isTabs ? 'tab' : 'radio'}
						{...(isTabs
							? {
									id: ids?.tabId,
									'aria-selected': isSelected,
									// Only the selected tab's panel is in the document, so
									// pointing at the others would dangle.
									...(isSelected ? { 'aria-controls': ids?.panelId } : {})
								}
							: { 'aria-checked': isSelected })}
						aria-label={option.ariaLabel}
						tabIndex={index === tabStopIndex ? 0 : -1}
						disabled={option.disabled}
						className={clsx(button, buttonClassName)}
						data-active={isSelected}
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

type TagGroupProps<V extends ReadonlyArray<string> = ReadonlyArray<string>> = React.ComponentProps<'div'> & {
	selectedValue: V[number] | null
	setValue: (value: V[number]) => void
	values: V
	variant: TagGroupVariant
	size: TagGroupSize
	label?: string
	ariaLabel?: string
	disabledValues?: ReadonlyArray<V[number]>
}

/** SegmentedControl adapter for plain string-list options; labels are the capitalized values. */
export function TagGroup<V extends ReadonlyArray<string>>({
	selectedValue,
	setValue,
	values,
	style,
	className,
	variant,
	size,
	label,
	ariaLabel,
	disabledValues,
	...props
}: TagGroupProps<V>) {
	return (
		<SegmentedControl
			value={selectedValue}
			onValueChange={setValue}
			options={values.map((value) => ({
				value,
				label: `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`,
				disabled: disabledValues?.includes(value)
			}))}
			label={ariaLabel ?? label ?? 'Options'}
			leading={label}
			variant={variant}
			size={size}
			className={className}
			style={style}
			{...props}
		/>
	)
}
