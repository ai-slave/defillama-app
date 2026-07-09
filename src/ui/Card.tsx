import type { ComponentPropsWithoutRef, ElementType } from 'react'

/**
 * Design-system card surface (see design.md): 8px default radius, subtle
 * stroke, bg-surface, spacing via constrained padding choices.
 *
 * `padding` is required and deliberately an enum, not a free value — the
 * p-2/p-3/p-4/p-5 drift across the old hand-rolled cards is exactly what
 * this component exists to end. `className` is for layout placement only (grid column,
 * margins, flex behavior); never pass visual overrides (bg-*, border-*,
 * rounded-*, p-*, hover/focus colors, type styles) — if a card needs to look
 * different, that's a new recipe to discuss, not a className.
 *
 * Adoption happens page-by-page during the redesign sweeps (the 8px radius
 * intentionally differs from the legacy rounded-md cards); all new code must
 * use it. Radius exceptions must be explicit primitive choices, not page-local
 * `rounded-*` overrides.
 */
type CardProps<T extends ElementType> = {
	as?: T
	padding: 'none' | 'sm' | 'md' | 'strip'
	radius?: 'default' | 'large'
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'padding'>

const PADDING = {
	none: '',
	sm: ' p-2',
	md: ' p-4',
	strip: ' px-4 py-3'
} as const

const RADIUS = {
	default: 'rounded-[8px]',
	large: 'rounded-[12px]'
} as const

export function Card<T extends ElementType = 'div'>({
	as,
	padding,
	radius = 'default',
	className,
	...props
}: CardProps<T>) {
	const Tag = (as ?? 'div') as ElementType
	return (
		<Tag
			className={`${RADIUS[radius]} border border-subtle bg-surface${PADDING[padding]}${className ? ` ${className}` : ''}`}
			{...props}
		/>
	)
}
