import * as Ariakit from '@ariakit/react'
import clsx from 'clsx'
import * as React from 'react'
import { Tab } from './Tabs'
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
		container: 'flex w-fit items-center rounded-md',
		button: 'shrink-0 px-3 whitespace-nowrap'
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
	options: ReadonlyArray<SegmentedControlOption<T>>
	label: string
	leading?: React.ReactNode
	variant: TagGroupVariant
	size: TagGroupSize
	className?: string
	buttonClassName?: string
} & (
		| { semantics?: 'radio'; value: T | null; onValueChange: (value: T) => void }
		| { semantics: 'tabs'; value?: never; onValueChange?: never }
	)

/** Single-value filters use radios; panel switches share their parent's Tabs provider. */
export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
	const {
		options,
		label,
		leading,
		variant,
		size,
		className,
		buttonClassName,
		semantics,
		value,
		onValueChange,
		...rest
	} = props
	const { container, button } = TAG_GROUP_VARIANTS[variant]
	const groupProps = {
		'aria-label': label,
		className: clsx(container, TAG_GROUP_SIZES[size], className)
	}
	// A selected venue can become empty after a data refresh. Preserve the value,
	// but keep one enabled entry point while Ariakit's active item is disabled.
	const selectedIsDisabled = semantics !== 'tabs' && options.some((option) => option.value === value && option.disabled)
	const firstEnabledValue = selectedIsDisabled ? options.find((option) => !option.disabled)?.value : undefined
	const controls = options.map((option) => {
		const controlProps = {
			'aria-label': option.ariaLabel,
			disabled: option.disabled,
			className: clsx(button, buttonClassName),
			children: option.label
		}
		const control =
			semantics === 'tabs' ? (
				<Tab value={option.value} {...controlProps} />
			) : (
				<label
					className={clsx(
						button,
						buttonClassName,
						'relative cursor-pointer has-focus-visible:focus-ring has-disabled:cursor-not-allowed',
						variant === 'solid' && 'inline-flex items-center justify-center',
						(variant === 'solid' || variant === 'solid-responsive') &&
							'data-[active=true]:has-focus-visible:focus-ring-on-brand'
					)}
					data-active={option.value === value}
					aria-disabled={option.disabled}
				>
					<Ariakit.Radio
						value={option.value}
						tabIndex={selectedIsDisabled ? (option.value === firstEnabledValue ? 0 : -1) : undefined}
						disabled={option.disabled}
						aria-label={option.ariaLabel}
						className="sr-only"
					/>
					{option.label}
				</label>
			)
		return (
			<React.Fragment key={option.value}>
				{option.tooltip ? <Tooltip content={option.tooltip}>{control}</Tooltip> : control}
			</React.Fragment>
		)
	})
	const content = (
		<>
			{leading ? <span className="pr-1 pl-3">{leading}</span> : null}
			{controls}
		</>
	)
	if (semantics === 'tabs') {
		return (
			<Ariakit.TabList {...rest} {...groupProps}>
				{content}
			</Ariakit.TabList>
		)
	}
	return (
		<Ariakit.RadioProvider
			orientation="both"
			value={value}
			setValue={(next) => {
				const option = options.find((item) => item.value === next)
				if (option && next !== value) onValueChange(option.value)
			}}
		>
			<Ariakit.RadioGroup {...rest} {...groupProps}>
				{content}
			</Ariakit.RadioGroup>
		</Ariakit.RadioProvider>
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
