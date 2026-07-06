import type { ComponentPropsWithoutRef, ElementType } from 'react'

/**
 * Design-system card surface (see design.md): 8px radius, medium stroke,
 * bg-surface, spacing via constrained padding variants.
 *
 * `padding` is deliberately an enum, not a free value — the p-2/p-3/p-4/p-5
 * drift across the old hand-rolled cards is exactly what this component
 * exists to end. `className` is for layout placement only (grid column,
 * margins, flex behavior); never pass visual overrides (bg-*, border-*,
 * rounded-*, p-*) — if a card needs to look different, that's a new variant
 * to discuss, not a className.
 *
 * Adoption happens page-by-page during the redesign sweeps (the 8px radius
 * intentionally differs from the legacy rounded-md cards); all new code must
 * use it.
 */
type CardProps<T extends ElementType> = {
	as?: T
	padding?: 'none' | 'sm' | 'md'
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'padding'>

const PADDING = {
	none: '',
	sm: ' p-2',
	md: ' p-4'
} as const

export function Card<T extends ElementType = 'div'>({ as, padding = 'md', className, ...props }: CardProps<T>) {
	const Tag = (as ?? 'div') as ElementType
	return (
		<Tag
			className={`rounded-lg border border-medium bg-surface${PADDING[padding]}${className ? ` ${className}` : ''}`}
			{...props}
		/>
	)
}
