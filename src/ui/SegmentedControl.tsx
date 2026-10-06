import * as Ariakit from '@ariakit/react'
import clsx from 'clsx'
import * as React from 'react'
import { Tab } from './Tabs'
import { Tooltip } from './Tooltip'

/* ----------------------------------------------------------------------------
   SegmentedControl — one pick from a short set of options, shown as segments.

   Variants (required, with `size`):
   - default:    the padded, tinted control for chart periods, denominations,
                 table metric and period filters, and view modes. Selected is
                 bg-brand-muted + text-link-on-tint; unselected is
                 text-secondary, text-primary on hover.
   - responsive: `default` that stretches its segments to the row below `sm`.
                 Use it in the phone filter menu (under a body-sm row label);
                 chart and table toolbars keep `default` so they never stretch.
   - field:      a choice that is a form field (visibility, owner): fills its
                 row with equal segments. Never a caller width override.
   - chips:      spaced rounded-full pills with no box around the row, for
                 a longer pick on its own row: a category or sector filter,
                 a status, a content type, a table's column group. The row
                 wraps, so every option stays visible on a phone; never put
                 it inside a scroll wrapper.
   - solid / solid-responsive: the joined toggle group, no padding, solid
                 bg-brand selection. Only for explicit scope switches such as
                 All | Protocols | Chains. Class-only hosts compose
                 `TAG_GROUP_VARIANTS.solid` with `TAG_GROUP_SIZES.md`.
   - pro:        ProDashboard's own look (ProSegmented).
   Out of room: default and responsive scroll inside their own box; pro
   scrolls in ProSegmented's wrapper; chips wrap; field never scrolls, so
   keep it to a few short options (stack two fields on a phone); solid
   clips, so keep its set short.
   Toolbars use size md (32px). In a phone sheet's rows the padded variants
   are 44px with a 4px inset and body-md labels. A disabled option dims to
   60% with the not-allowed cursor, like Button; its reason stays in visible
   text or the option's `tooltip`.

   `semantics` picks what the control announces; the look is the same:
   - radio (default): a value that reconfigures one region (a period, a
     denomination, a chart metric, a grouping). Nothing appears or
     disappears, so it is a radiogroup. The caller holds `value`.
   - tabs: switching between distinct content panels. Render it inside a
     `Tabs` provider from ./Tabs, which holds the value, and give each panel
     a `TabPanel`; the provider wires every tab's id and aria-controls to
     its panel. `Tabs` defaults to `selectOnMove={false}`: arrow keys move
     focus and Enter or Space selects. Panels stay mounted while hidden
     unless the caller unmounts them.
   Never convert a value picker to tabs to make controls uniform. Page-level
   route navigation is `TabLink` in ./Tab.tsx, never this control; its
   header says which tab look goes where.
   A phone-only pane switch (Configure | Preview in a workspace dialog)
   stays a radio: on desktop both panes show side by side, so they are not
   tab panels, and the switch only picks which one fills a phone screen.
---------------------------------------------------------------------------- */
export const TAG_GROUP_VARIANTS = {
	default: {
		container:
			'body-sm flex w-fit flex-nowrap items-center gap-0.5 overflow-x-auto overflow-y-hidden rounded-lg border border-medium bg-surface p-0.5 sheet:min-h-11 sheet:p-1 sheet:body-md',
		button:
			'touch-target before:inset-x-0 hover-wash shrink-0 rounded-md px-2 py-1 whitespace-nowrap text-secondary sheet:self-stretch hover:text-primary data-[active=true]:bg-brand-muted data-[active=true]:text-link-on-tint'
	},
	chips: {
		container: 'flex w-fit max-w-full flex-wrap items-center gap-1.5',
		button:
			'touch-target hover-wash shrink-0 rounded-full border border-medium px-3 py-1.5 label-sm whitespace-nowrap text-primary hover:border-brand focus-visible:border-brand data-[active=true]:border-brand data-[active=true]:bg-brand-muted data-[active=true]:text-link-on-tint'
	},
	// A form field's choice (visibility, owner): fills its row with equal segments, icon beside label.
	field: {
		container:
			'body-sm flex w-full flex-nowrap items-center gap-0.5 rounded-lg border border-medium bg-surface p-0.5 sheet:min-h-11 sheet:p-1 sheet:body-md',
		button:
			'touch-target hover-wash inline-flex flex-1 basis-0 items-center justify-center gap-1.5 rounded-md px-2 py-1 whitespace-nowrap sheet:self-stretch text-secondary hover:text-primary data-[active=true]:bg-brand-muted data-[active=true]:text-link-on-tint'
	},
	responsive: {
		container:
			'body-sm flex w-fit flex-nowrap items-center gap-0.5 overflow-x-auto overflow-y-hidden rounded-lg border border-medium bg-surface p-0.5 max-sm:w-full sheet:min-h-11 sheet:p-1 sheet:body-md',
		button:
			'touch-target before:inset-x-0 hover-wash inline-flex max-sm:flex-1 items-center justify-center shrink-0 rounded-md px-2 py-1 whitespace-nowrap sheet:self-stretch text-secondary hover:text-primary data-[active=true]:bg-brand-muted data-[active=true]:text-link-on-tint'
	},
	solid: {
		container: 'body-sm flex w-fit flex-nowrap items-center overflow-hidden rounded-md border border-subtle',
		button:
			'touch-target hover-wash shrink-0 self-stretch px-2 whitespace-nowrap text-primary data-[active=true]:bg-brand data-[active=true]:text-on-brand'
	},
	'solid-responsive': {
		container:
			'body-sm flex w-fit flex-nowrap items-center overflow-hidden rounded-md border border-subtle max-sm:w-full',
		button:
			'touch-target hover-wash inline-flex max-sm:flex-1 items-center justify-center shrink-0 self-stretch px-2 whitespace-nowrap text-primary data-[active=true]:bg-brand data-[active=true]:text-on-brand'
	},
	pro: {
		container: 'flex w-fit items-center rounded-md',
		button: 'shrink-0 px-3 whitespace-nowrap'
	}
} as const

/* The scrolling variants (default, responsive) keep each segment's touch target inside the row (chips wrap instead): a target
   reaching past a scroller's edge makes it scroll, which draws a scrollbar beside the last segment on touch screens.
   Chart/table toolbar contexts are md (32px); dense gaps come from Toolbar. */
export const TAG_GROUP_SIZES = {
	sm: 'min-h-6',
	md: 'min-h-8'
} as const

export const chartSegmentedControlGroupStyles = `${TAG_GROUP_VARIANTS.default.container} ${TAG_GROUP_SIZES.md}`

export type TagGroupSize = keyof typeof TAG_GROUP_SIZES

/* An option with a tooltip sits inside the tooltip's anchor span, which becomes the row's flex item, so the span takes
   the segment's stretch: equal segments in `field`, a stretched row below sm in the responsive variants. */
const tooltipAnchorSizing: Partial<Record<TagGroupVariant, string>> = {
	field: 'flex-1 basis-0',
	responsive: 'max-sm:flex-1',
	'solid-responsive': 'max-sm:flex-1'
}
type TagGroupVariant = keyof typeof TAG_GROUP_VARIANTS

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
				<Tab
					value={option.value}
					{...controlProps}
					className={clsx(
						controlProps.className,
						'disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60'
					)}
				/>
			) : (
				<label
					className={clsx(
						button,
						buttonClassName,
						'relative cursor-pointer has-focus-visible:focus-ring has-disabled:cursor-not-allowed has-disabled:opacity-60',
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
				{option.tooltip ? (
					<Tooltip content={option.tooltip} className={tooltipAnchorSizing[variant]}>
						{control}
					</Tooltip>
				) : (
					control
				)}
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
