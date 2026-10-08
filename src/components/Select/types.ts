import type { ReactNode } from 'react'

export type SelectOption = {
	key: string
	name: string
	help?: string
	icon?: ReactNode
	/** Drawn greyed out: a value the page's current settings leave out. */
	muted?: boolean
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

const SELECT_TRIGGER_VARIANTS = {
	default:
		'touch-target label-sm flex cursor-pointer flex-nowrap items-center gap-2 rounded-lg bg-surface-elevated-1 px-3 py-2 text-primary hover:bg-surface-elevated-2 focus-visible:bg-surface-elevated-2',
	filter:
		'touch-target label-sm relative flex min-h-6 cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-md border border-medium px-2 py-0.5 text-primary hover:bg-hover-row focus-visible:bg-hover-row',
	/* Input-style trigger for form-like filter panels: a bg-page field with the
	   field's outline (border-medium, border-strong on hover) and a
	   focus:border-brand indicator (outline-hidden is valid per the focus
	   rule — the border is the indicator). */
	input:
		'touch-target label-sm flex min-h-8 min-w-0 cursor-pointer items-center gap-1.5 hover-wash rounded-lg border border-medium bg-page bg-clip-padding px-3 py-1.5 text-primary outline-hidden not-focus:not-disabled:not-aria-disabled:not-aria-invalid:hover:border-strong focus:border-brand disabled:not-aria-busy:cursor-not-allowed disabled:not-aria-busy:border-disabled disabled:not-aria-busy:bg-disabled disabled:not-aria-busy:text-disabled aria-busy:cursor-progress sheet:min-h-11 sheet:label-md'
} as const

export type SelectTriggerVariant = keyof typeof SELECT_TRIGGER_VARIANTS

/* Panel headers use 32px (md) controls everywhere. The
   md filter trigger mirrors Button md so selects line up with .csv/.png, and
   in a phone sheet's rows it is 44px like Button md. */
const SELECT_TRIGGER_MD_VARIANTS: Partial<Record<SelectTriggerVariant, string>> = {
	filter:
		'touch-target label-sm relative flex min-h-8 cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-lg border border-medium px-3 py-1.5 text-primary hover:bg-hover-row focus-visible:bg-hover-row disabled:not-aria-busy:cursor-not-allowed disabled:not-aria-busy:border-disabled disabled:not-aria-busy:text-disabled aria-busy:cursor-progress sheet:min-h-11 sheet:label-md'
}

export type SelectTriggerSize = 'sm' | 'md'

export function selectTriggerStyles(variant: SelectTriggerVariant, size: SelectTriggerSize): string {
	if (size === 'md') {
		return SELECT_TRIGGER_MD_VARIANTS[variant] ?? SELECT_TRIGGER_VARIANTS[variant]
	}
	return SELECT_TRIGGER_VARIANTS[variant]
}
