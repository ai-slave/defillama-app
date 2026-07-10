import type { ComponentPropsWithRef, ElementType } from 'react'

/* ----------------------------------------------------------------------------
   Button — the design.md button recipe (see "Component recipes").

   Variants map to the Figma frames:
   - secondary: transparent + border-medium (default toolbar/action button)
   - primary:   bg-brand + text-on-brand (one per view: Done, Sign-in, …)
   - outline:   border-brand + text-link ("active = branded" toggles/chips)
   - filter:    rounded-full brand-border filter pill (metrics directory)
   - toggle:    filled toolbar filter with a brand-tinted active state
   - metricBrowse: dashed 6px-radius selected pill in the home metrics browse bar

   Heights are PADDING-DRIVEN, never fixed: every control in a row shares
   the same py, so mixed content (text, icons, both) always lines up. Text
   floor is 12px (label-sm) — the frames' 10px control text was rejected
   as too small.

   `className` is for LAYOUT PLACEMENT ONLY (ml-auto, w-full, shrink-0…),
   same contract as Card. If you need different colors/spacing, that is a
   new variant to agree on in design.md, not a className override.

   For Ariakit hosts, prefer composing the component itself:
   <Ariakit.DialogDisclosure render={<Button size="md" />}>…</Ariakit.DialogDisclosure>
   `buttonStyles(...)` exists for the rare host that only takes a class.
---------------------------------------------------------------------------- */

type ButtonVariant = 'secondary' | 'primary' | 'outline' | 'ghost' | 'filter' | 'toggle' | 'metricBrowse'
type ButtonSize = 'sm' | 'md'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
	secondary: 'border border-medium text-primary hover:bg-hover-row focus-visible:bg-hover-row',
	primary:
		'border border-transparent bg-brand text-on-brand hover:brightness-110 focus-visible:brightness-110 focus-visible:focus-ring-on-brand',
	outline: 'border border-brand text-link hover:bg-hover-row focus-visible:bg-hover-row',
	ghost:
		'border border-transparent text-secondary hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary',
	filter: 'hover-wash border border-brand text-primary data-[active=true]:bg-brand-muted',
	toggle:
		'border border-medium bg-surface-elevated-1 text-primary hover:bg-hover-row focus-visible:bg-hover-row data-[active=true]:border-brand data-[active=true]:bg-brand-muted data-[active=true]:text-link',
	metricBrowse: 'hover-wash border border-dashed border-brand bg-brand-muted text-primary'
}

/* min-h pins the control heights the frames use (sm 24, md 32) so rows of
   mixed content (16px icons vs 16px text lines) stay exactly level; padding
   supplies the breathing room within. sm py is 0.5 (not 1) because label-sm's
   16px line + py-1 + border = 26px would overshoot the 24px floor — content
   must stay under min-h so the floor decides the height. */
const SIZE_CLASSES: Record<ButtonSize, string> = {
	sm: 'label-sm min-h-6 gap-1 px-2 py-0.5',
	md: 'label-sm min-h-8 gap-1 px-3 py-1.5'
}

/** Icon-only buttons: aspect-square + self-center so flex rows can't stretch them. */
const SQUARE_SIZE_CLASSES: Record<ButtonSize, string> = {
	sm: 'aspect-square min-h-6 self-center p-0.5',
	md: 'aspect-square min-h-8 self-center p-1.5'
}

const RADIUS_CLASSES: Record<ButtonSize, string> = {
	sm: 'rounded-md',
	md: 'rounded-lg'
}

export function buttonStyles({
	variant = 'secondary',
	size,
	square = false
}: {
	variant?: ButtonVariant
	size: ButtonSize
	square?: boolean
}): string {
	return `flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60 ${
		square ? SQUARE_SIZE_CLASSES[size] : SIZE_CLASSES[size]
	} ${variant === 'filter' ? 'rounded-full' : RADIUS_CLASSES[size]} ${VARIANT_CLASSES[variant]}`
}

type ButtonProps<T extends ElementType> = {
	as?: T
	variant?: ButtonVariant
	size: ButtonSize
	square?: boolean
	/** Layout placement only (ml-auto, w-full, …) — never colors or spacing. */
	className?: string
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function Button<T extends ElementType = 'button'>({
	as,
	variant = 'secondary',
	size,
	square = false,
	className,
	...props
}: ButtonProps<T>) {
	const Component = (as ?? 'button') as ElementType
	return <Component className={`${buttonStyles({ variant, size, square })} ${className ?? ''}`.trim()} {...props} />
}
