import type { ReactNode } from 'react'

export type SelectOption = {
	key: string
	name: string
	help?: string
	isCustom?: boolean
	customIndex?: number
	icon?: ReactNode
}

export type SelectValues = ReadonlyArray<SelectOption> | ReadonlyArray<string>

export type ExcludeQueryKey = `exclude${string}`

export type MultiSelectOption = {
	value: string
	label: string
	disabled?: boolean
	logo?: string
	isChild?: boolean
}

const SELECT_TRIGGER_VARIANTS = {
	default:
		'label-sm flex cursor-pointer flex-nowrap items-center gap-2 rounded-md bg-surface-elevated-1 px-3 py-2 text-primary hover:bg-surface-elevated-2 focus-visible:bg-surface-elevated-2',
	filter:
		'label-sm relative flex min-h-6 cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-md border border-medium px-2 py-0.5 text-primary hover:bg-hover-row focus-visible:bg-hover-row',
	/* Input-style trigger for form-like filter panels: a bg-page field with a
	   focus:border-brand indicator (outline-hidden is valid per the focus
	   rule — the border is the indicator). */
	input:
		'label-sm flex min-h-8 min-w-0 cursor-pointer items-center gap-1.5 hover-wash rounded-[8px] border border-medium bg-page px-3 py-1.5 text-primary outline-hidden focus:border-brand',
	'filter-responsive':
		'label-sm relative flex min-h-6 w-full cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-md border border-medium px-2 py-0.5 text-primary hover:bg-hover-row focus-visible:bg-hover-row sm:w-auto',
	pro: 'hover:not-disabled:pro-btn-blue focus-visible:not-disabled:pro-btn-blue flex items-center gap-1 rounded-md border border-medium px-1.5 py-1 text-xs hover:border-transparent focus-visible:border-transparent disabled:border-subtle disabled:text-disabled'
} as const

export type SelectTriggerVariant = keyof typeof SELECT_TRIGGER_VARIANTS

/* Panel headers use 32px (md) controls everywhere (Figma 6183:148797) — the
   md filter trigger mirrors Button md so selects line up with .csv/.png. */
const SELECT_TRIGGER_MD_VARIANTS: Partial<Record<SelectTriggerVariant, string>> = {
	filter:
		'label-sm relative flex min-h-8 cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-[8px] border border-medium px-3 py-1.5 text-primary hover:bg-hover-row focus-visible:bg-hover-row',
	'filter-responsive':
		'label-sm relative flex min-h-8 w-full cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-[8px] border border-medium px-3 py-1.5 text-primary hover:bg-hover-row focus-visible:bg-hover-row sm:w-auto'
}

export type SelectTriggerSize = 'sm' | 'md'

export function selectTriggerStyles(variant: SelectTriggerVariant, size: SelectTriggerSize): string {
	if (size === 'md') {
		return SELECT_TRIGGER_MD_VARIANTS[variant] ?? SELECT_TRIGGER_VARIANTS[variant]
	}
	return SELECT_TRIGGER_VARIANTS[variant]
}

/* Two selection controls in the design system — do not conflate:
   - default/responsive = the Figma "Tabs" SEGMENTED control (nodes
     6476:29323, 6183:313202): padded bg-surface wrapper, TINTED selection
     (bg-brand-muted + text-link). For chart periods, denominations,
     view-mode switches.
   - solid = the compact joined toggle group (node 6183:354509 / 6183:354649):
     no wrapper padding, 6px outer radius, SOLID bg-brand selection. Use only for explicit
     scope switches such as the metrics header All|Protocols|Chains exception. */
export const TAG_GROUP_VARIANTS = {
	default: {
		container:
			'body-sm flex w-fit flex-nowrap items-center gap-0.5 overflow-x-auto rounded-[8px] border border-medium bg-surface p-0.5',
		button:
			'hover-wash shrink-0 rounded-md px-2 py-1 whitespace-nowrap text-secondary hover:text-primary data-[active=true]:bg-brand-muted data-[active=true]:text-link'
	},
	responsive: {
		container:
			'body-sm flex w-fit flex-nowrap items-center gap-0.5 overflow-x-auto rounded-[8px] border border-medium bg-surface p-0.5 max-sm:w-full',
		button:
			'hover-wash inline-flex max-sm:flex-1 items-center justify-center shrink-0 rounded-md px-2 py-1 whitespace-nowrap text-secondary hover:text-primary data-[active=true]:bg-brand-muted data-[active=true]:text-link'
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
		container: 'text-sm flex items-center overflow-x-auto flex-nowrap w-fit border pro-border pro-text1',
		button:
			'shrink-0 px-3 py-1.5 whitespace-nowrap hover:pro-bg2 focus-visible:pro-bg2 data-[active=true]:bg-(--legacy-primary) data-[active=true]:text-white'
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
