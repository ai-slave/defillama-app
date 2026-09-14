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
	selectedLabel?: string
	disabled?: boolean
	logo?: string
	isChild?: boolean
}

const PRO_TRIGGER_BASE =
	'hover:not-disabled:pro-btn-primary focus-visible:not-disabled:pro-btn-primary flex items-center gap-1 rounded-md border border-pro-cards-border hover:border-transparent focus-visible:border-transparent disabled:border-subtle disabled:text-disabled'

const SELECT_TRIGGER_VARIANTS = {
	default:
		'label-sm flex cursor-pointer flex-nowrap items-center gap-2 rounded-md bg-surface-elevated-1 px-3 py-2 text-primary hover:bg-surface-elevated-2 focus-visible:bg-surface-elevated-2',
	filter:
		'label-sm relative flex min-h-6 cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-md border border-medium px-2 py-0.5 text-primary hover:bg-hover-row focus-visible:bg-hover-row',
	/* Input-style trigger for form-like filter panels: a bg-page field with a
	   focus:border-brand indicator (outline-hidden is valid per the focus
	   rule — the border is the indicator). */
	input:
		'label-sm flex min-h-8 min-w-0 cursor-pointer items-center gap-1.5 hover-wash rounded-lg border border-medium bg-page px-3 py-1.5 text-primary outline-hidden focus:border-brand',
	'filter-responsive':
		'label-sm relative flex min-h-6 w-full cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-md border border-medium px-2 py-0.5 text-primary hover:bg-hover-row focus-visible:bg-hover-row sm:w-auto',
	pro: `${PRO_TRIGGER_BASE} min-h-6 px-2 text-xs`
} as const

export type SelectTriggerVariant = keyof typeof SELECT_TRIGGER_VARIANTS

/* Panel headers use 32px (md) controls everywhere (Figma 6183:148797) — the
   md filter trigger mirrors Button md so selects line up with .csv/.png. */
const SELECT_TRIGGER_MD_VARIANTS: Partial<Record<SelectTriggerVariant, string>> = {
	filter:
		'label-sm relative flex min-h-8 cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-lg border border-medium px-3 py-1.5 text-primary hover:bg-hover-row focus-visible:bg-hover-row',
	'filter-responsive':
		'label-sm relative flex min-h-8 w-full cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-lg border border-medium px-3 py-1.5 text-primary hover:bg-hover-row focus-visible:bg-hover-row sm:w-auto',
	pro: `${PRO_TRIGGER_BASE} min-h-8 px-3 text-sm`
}

export type SelectTriggerSize = 'sm' | 'md'

export function selectTriggerStyles(variant: SelectTriggerVariant, size: SelectTriggerSize): string {
	if (size === 'md') {
		return SELECT_TRIGGER_MD_VARIANTS[variant] ?? SELECT_TRIGGER_VARIANTS[variant]
	}
	return SELECT_TRIGGER_VARIANTS[variant]
}
