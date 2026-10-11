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
                 bg-brand-muted + text-link; unselected is
                 text-secondary, text-primary on hover.
   - responsive: `default` that stretches its segments to the row below `sm`.
                 Use it in the phone filter menu (under a body-sm row label);
                 chart and table toolbars keep `default` so they never stretch.
   - field:      a choice that is a form field (visibility, owner): fills its
                 row with equal segments. Never a caller width override.
   - mode:       a switch between whole workspaces that sits beside a primary
                 action (LlamaAI Chat | Terminal above New chat). Selected is
                 a neutral fill, so the switch never outshines the action.
                 Equal segments stack in a column (an icon rail); pass
                 `grid-flow-col` to lay them side by side.
   - chips:      spaced rounded-full pills with no box around the row, for
                 a longer pick on its own row: a category or sector filter,
                 a status, a content type, a table's column group. The row
                 wraps, so every option stays visible on a phone; never put
                 it inside a scroll wrapper.
   - solid / solid-responsive: the joined toggle group, no padding, solid
                 bg-brand selection. Only for explicit scope switches such as
                 All | Protocols | Chains. Class-only hosts compose
                 `TAG_GROUP_VARIANTS.solid` with `TAG_GROUP_SIZES.md`.
   Out of room: default and responsive cap at their container's width and
   scroll inside their own box, so never wrap them in a scroller; chips
   wrap; field never scrolls, so keep it to a few short options (stack two
   fields on a phone); solid clips, so keep its set short.
   Toolbars use size md (32px); size sm (24px) sits beside sm Buttons and
   Selects in dense card headers. In a phone sheet's rows the padded variants
   are 44px with a 4px inset and body-md labels. A disabled option dims to
   60% with the not-allowed cursor, like Button; its reason stays in visible
   text.
   An option's label is plain text or a fragment (icon, text, count): every
   segment lays its children out as one centered row with its own gap, so a
   label never brings a wrapper span, and never a QuestionHelper or other
   focusable part: it would be a tab stop inside the option.
   An option's definition is its `tooltip`, anchored on the element that takes
   focus (the tab, or the radio spread over its segment), so hover and keyboard
   focus open it. Screen readers do not announce it (Tooltip header). A "?"
   icon in the label may mark it. A tap selects the option and does not
   open the tooltip: touch readers trade the definition for one tap target,
   as on every control with a tooltip.

   `semantics` picks what the control announces; the look is the same:
   - radio (default): a value that reconfigures one region (a period, a
     denomination, a chart metric, a grouping). Nothing appears or
     disappears, so it is a radiogroup. The caller holds `value`; whether
     it lives in the URL or in state is in docs/url-state.md.
   - tabs: switching between distinct content panels. Render it inside a
     `Tabs` provider from ./Tabs, which holds the value, and give each panel
     a `TabPanel`; the provider wires every tab's id and aria-controls to
     its panel. `Tabs` defaults to `selectOnMove={false}`: arrow keys move
     focus and Enter or Space selects. Panels stay mounted while hidden
     unless the caller unmounts them.
   Never convert a value picker to tabs to make controls uniform. Page-level
   route navigation is `TabLink` in ./Tabs.tsx, never this control; that
   file's header says which tab look goes where.
   A phone-only pane switch (Configure | Preview in a workspace dialog)
   stays a radio: on desktop both panes show side by side, so they are not
   tab panels, and the switch only picks which one fills a phone screen.
---------------------------------------------------------------------------- */
export const TAG_GROUP_VARIANTS = {
	default: {
		container:
			'body-sm flex w-fit max-w-full flex-nowrap items-center gap-0.5 overflow-x-auto overflow-y-hidden rounded-lg border border-medium bg-surface p-0.5 sheet:min-h-11 sheet:p-1 sheet:body-md',
		button:
			'touch-target pointer-coarse:before:inset-x-0 hover-wash inline-flex shrink-0 items-center justify-center gap-1 rounded-md px-2 whitespace-nowrap text-secondary sheet:self-stretch hover:text-primary data-[active=true]:bg-brand-muted data-[active=true]:text-link'
	},
	mode: {
		container: 'body-sm grid shrink-0 auto-cols-fr gap-0.5 rounded-lg border border-medium bg-surface p-0.5',
		button:
			'touch-target hover-wash inline-flex items-center justify-center gap-1.5 rounded-md px-2 whitespace-nowrap text-secondary hover:text-primary data-[active=true]:bg-surface-elevated-2 data-[active=true]:text-primary'
	},
	chips: {
		container: 'flex w-fit max-w-full flex-wrap items-center gap-1.5',
		button:
			'touch-target hover-wash inline-flex shrink-0 items-center justify-center gap-1 rounded-full border border-medium px-3 label-sm whitespace-nowrap text-primary hover:border-brand focus-visible:border-brand data-[active=true]:border-brand data-[active=true]:bg-brand-muted data-[active=true]:text-link'
	},
	// A form field's choice (visibility, owner): fills its row with equal segments, icon beside label.
	field: {
		container:
			'body-sm flex w-full flex-nowrap items-center gap-0.5 rounded-lg border border-medium bg-surface p-0.5 sheet:min-h-11 sheet:p-1 sheet:body-md',
		button:
			'touch-target hover-wash inline-flex flex-1 basis-0 items-center justify-center gap-1.5 rounded-md px-2 whitespace-nowrap sheet:self-stretch text-secondary hover:text-primary data-[active=true]:bg-brand-muted data-[active=true]:text-link'
	},
	responsive: {
		container:
			'body-sm flex w-fit max-w-full flex-nowrap items-center gap-0.5 overflow-x-auto overflow-y-hidden rounded-lg border border-medium bg-surface p-0.5 max-sm:w-full sheet:min-h-11 sheet:p-1 sheet:body-md',
		button:
			'touch-target pointer-coarse:before:inset-x-0 hover-wash inline-flex max-sm:flex-1 items-center justify-center shrink-0 rounded-md px-2 whitespace-nowrap sheet:self-stretch text-secondary hover:text-primary data-[active=true]:bg-brand-muted data-[active=true]:text-link'
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
	}
} as const

/* The scrolling variants (default, responsive) keep each segment's touch target inside the row (chips wrap instead): a target
   reaching past a scroller's edge makes it scroll, which draws a scrollbar beside the last segment on touch screens.
   Chart/table toolbar contexts are md (32px); dense gaps come from Toolbar. */
export const TAG_GROUP_SIZES = {
	sm: 'min-h-6',
	md: 'min-h-8'
} as const

/* Each size's segment padding, so a boxed row lands on its min-h: sm is 24px like sm Buttons and Selects (16px label,
   1px padding, the box's 2px inset and 1px border), md 32px. Chips keep one pill height; solid segments stretch. */
export const TAG_GROUP_BUTTON_SIZES: Record<TagGroupVariant, Record<keyof typeof TAG_GROUP_SIZES, string>> = {
	default: { sm: 'py-px', md: 'py-1' },
	responsive: { sm: 'py-px', md: 'py-1' },
	field: { sm: 'py-px', md: 'py-1' },
	mode: { sm: 'py-px', md: 'py-1' },
	chips: { sm: 'py-1.5', md: 'py-1.5' },
	solid: { sm: '', md: '' },
	'solid-responsive': { sm: '', md: '' }
}

type TagGroupSize = keyof typeof TAG_GROUP_SIZES

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
	const container = TAG_GROUP_VARIANTS[variant].container
	const button = clsx(TAG_GROUP_VARIANTS[variant].button, TAG_GROUP_BUTTON_SIZES[variant][size])
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
		if (semantics === 'tabs') {
			const tab = (
				<Tab
					value={option.value}
					{...controlProps}
					className={clsx(
						controlProps.className,
						'disabled:cursor-not-allowed disabled:text-disabled aria-disabled:cursor-not-allowed aria-disabled:text-disabled'
					)}
				/>
			)
			return option.tooltip ? (
				<Tooltip key={option.value} content={option.tooltip} render={tab} />
			) : (
				<React.Fragment key={option.value}>{tab}</React.Fragment>
			)
		}
		// The radio spreads over its segment, so it takes the segment's clicks and anchors the option's tooltip.
		const radio = (
			<Ariakit.Radio
				value={option.value}
				tabIndex={selectedIsDisabled ? (option.value === firstEnabledValue ? 0 : -1) : undefined}
				disabled={option.disabled}
				aria-label={option.ariaLabel}
				className="absolute inset-0 cursor-[inherit] opacity-[0.00001]"
			/>
		)
		return (
			<label
				className={clsx(
					button,
					buttonClassName,
					'relative cursor-pointer has-focus-visible:focus-ring has-disabled:cursor-not-allowed has-disabled:text-disabled',
					variant === 'solid' && 'inline-flex items-center justify-center',
					(variant === 'solid' || variant === 'solid-responsive') &&
						'data-[active=true]:has-focus-visible:focus-ring-on-brand'
				)}
				key={option.value}
				data-active={option.value === value}
				aria-disabled={option.disabled}
			>
				{option.tooltip ? <Tooltip content={option.tooltip} render={radio} /> : radio}
				{option.label}
			</label>
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
