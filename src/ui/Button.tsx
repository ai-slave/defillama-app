import type { ComponentPropsWithRef, ElementType, MouseEvent } from 'react'
import { LoadingSpinner } from './Loaders'

/* ----------------------------------------------------------------------------
   Button — the design.md button recipe (see "Component recipes").

   Variants map to the Figma frames:
   - secondary: transparent + border-medium (default toolbar/action button)
   - primary:   bg-brand + text-on-brand (one per view: Done, Sign-in, …)
   - outline:   border-brand + text-link ("active = branded" toggles/chips)
   - destructive: outlined data-down treatment for irreversible actions
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

   `pendingLabel` is the pending state: while an action runs, pass its label
   ("Saving…") and the button shows a spinner and that label, stays focusable
   (aria-disabled, announced as busy) and ignores clicks, so a form cannot
   submit twice through Enter either. It keeps full colour, unlike a disabled
   button, so it reads as working, even when a disabled <fieldset> around it
   also disables it (the `not-aria-busy` guards). Pass null once the action settles.

   For Ariakit hosts, prefer composing the component itself:
   <Ariakit.DialogDisclosure render={<Button size="md" />}>…</Ariakit.DialogDisclosure>
   `buttonStyles(...)` exists for the rare host that only takes a class.
---------------------------------------------------------------------------- */

type ButtonVariant =
	| 'secondary'
	| 'primary'
	| 'outline'
	| 'destructive'
	| 'ghost'
	| 'filter'
	| 'toggle'
	| 'metricBrowse'
type ButtonSize = 'sm' | 'md'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
	secondary:
		'border border-medium text-primary not-disabled:not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row',
	primary:
		'border border-transparent bg-brand text-on-brand not-disabled:not-aria-disabled:hover:brightness-110 not-disabled:not-aria-disabled:focus-visible:brightness-110 focus-visible:focus-ring-on-brand',
	outline: 'border border-brand text-link not-disabled:not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row',
	destructive:
		'border border-data-down text-data-down not-disabled:not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row',
	ghost:
		'hover-wash border border-transparent data-[active=true]:bg-brand-muted data-[active=true]:text-link-on-tint text-secondary not-disabled:not-aria-disabled:hover:text-primary focus-visible:text-primary',
	filter: 'hover-wash border border-brand text-primary data-[active=true]:bg-brand-muted',
	toggle:
		'hover-wash border border-medium bg-surface-elevated-1 text-primary data-[active=true]:border-brand data-[active=true]:bg-brand-muted data-[active=true]:text-link-on-tint',
	metricBrowse: 'hover-wash border border-dashed border-brand bg-brand-muted text-primary'
}

/* min-h pins the control heights the frames use (sm 24, md 32) so rows of
   mixed content (16px icons vs 16px text lines) stay exactly level; padding
   supplies the breathing room within. sm py is 0.5 (not 1) because label-sm's
   16px line + py-1 + border = 26px would overshoot the 24px floor — content
   must stay under min-h so the floor decides the height. A text md button in
   a phone sheet's rows is 44px with a 14px label (`sheet:`), level with the
   fields beside it and the footer below; sm and icon-only buttons keep their size there, and
   touch screens give every size a 44px touch target instead. */
const SIZE_CLASSES: Record<ButtonSize, string> = {
	sm: 'label-sm min-h-6 gap-1 px-2 py-0.5',
	md: 'label-sm min-h-8 gap-1 px-3 py-1.5 sheet:min-h-11 sheet:label-md'
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
	return `touch-target flex min-w-fit shrink-0 cursor-pointer items-center justify-center whitespace-nowrap disabled:not-aria-busy:cursor-not-allowed disabled:not-aria-busy:opacity-60 aria-disabled:not-aria-busy:cursor-not-allowed aria-disabled:not-aria-busy:opacity-60 aria-busy:cursor-progress ${
		square ? SQUARE_SIZE_CLASSES[size] : SIZE_CLASSES[size]
	} ${variant === 'filter' ? 'rounded-full' : RADIUS_CLASSES[size]} ${VARIANT_CLASSES[variant]}`
}

type ButtonProps<T extends ElementType> = {
	as?: T
	variant?: ButtonVariant
	size: ButtonSize
	square?: boolean
	/** Set while the button's action runs; the button shows a spinner and this label and ignores clicks. */
	pendingLabel?: string | null
	/** Layout placement only (ml-auto, w-full, …) — never colors or spacing. */
	className?: string | undefined
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function Button<T extends ElementType = 'button'>({
	as,
	variant = 'secondary',
	size,
	square = false,
	pendingLabel = null,
	className,
	...props
}: ButtonProps<T>) {
	const Component = (as ?? 'button') as ElementType
	const classes = `${buttonStyles({ variant, size, square })} ${className ?? ''}`.trim()
	if (pendingLabel === null) return <Component className={classes} {...props} />
	return (
		<Component
			className={classes}
			{...props}
			aria-disabled
			aria-busy
			// A pending button swallows clicks, including the one a form's Enter key sends to its submit button.
			onClick={(event: MouseEvent) => event.preventDefault()}
		>
			{square ? (
				// An icon-only button has no room for a label: the spinner replaces the icon, the label is announced.
				<>
					<LoadingSpinner size={14} />
					<span className="sr-only">{pendingLabel}</span>
				</>
			) : (
				// The idle content stays in the same grid cell, invisible and hidden from assistive tech, so the button
				// keeps the wider of its two widths and the row around it does not reflow while the action runs.
				<span className="grid">
					<span aria-hidden className="invisible col-start-1 row-start-1 flex items-center justify-center gap-1">
						{props.children}
					</span>
					<span className="col-start-1 row-start-1 flex items-center justify-center gap-1">
						<LoadingSpinner size={14} />
						{pendingLabel}
					</span>
				</span>
			)}
		</Component>
	)
}
