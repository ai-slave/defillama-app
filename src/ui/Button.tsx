import * as Ariakit from '@ariakit/react'
import type { ComponentPropsWithRef, ElementType, ReactNode } from 'react'
import { LoadingSpinner } from './Loaders'

/* ----------------------------------------------------------------------------
   Button — every action button. Callers choose `size`; `variant` defaults to
   secondary.

   Variants:
   - secondary:   transparent + border-medium (default toolbar/action button)
   - primary:     bg-brand + text-on-brand (one per view: Done, Sign-in, …;
                  a dismissible banner's single CTA, an empty state's CTA and
                  a repeated cell's Run may also be primary)
   - outline:     border-brand + text-link
   - destructive: border-error-muted + text-error for irreversible actions;
                  hover and focus tint in its own red (bg-error-muted), never
                  the neutral row wash
   - ghostDestructive: a quiet icon-only delete in a dense row (trash on a
                  saved query, draft or preset); turns error red, on the
                  red wash, on hover, focus and touch screens. Red marks data loss only: unpin,
                  clear a selection or remove a filter stay ghost
   - ghost:       borderless quiet trigger; `data-active` gives it the
                  brand-muted fill and text-link
   - filter:      rounded-full brand-border pill; `data-active` tints it.
                  Metrics-directory category filters and removable
                  active-filter pills (label + x) use `filter` size="sm";
                  never hand-roll the pill classes
   - toggle:      elevated neutral fill, brand border/tint/text-link
                  when `data-active`: toolbar filters and selectable options
   - metricBrowse: dashed brand pill in the home metrics browse toolbar
   - overlay:     opaque surface with a border and shadow, for a rail scroll
                  arrow that floats over scrolling content. It owns its
                  reveal: hidden until the pointer enters the `group/rail`
                  container around it or it takes focus. The call site
                  passes placement only
   - link:        text-link with no padding, no height and no type of its own,
                  so it inherits the sentence or label it sits in, case
                  included (preflight resets a button's text-transform): "Back to
                  history", "Use another sign-in method", "Sign out". A retry
                  after an error is a secondary sm "Try again", never a link
                  (docs/focus-and-errors.md). The row around a link carries a
                  named type style (`label-sm`, `body-sm`), never a raw text-*.
                  Takes no `size`. Anything aligned to a text edge or inside a
                  sentence is a link; ghost is a quiet button among other
                  buttons. Never pull a text action into line with a
                  negative margin; that is what the link's missing padding is for.
   Pick a pill by its job: a removable active filter or a filter picker is
   `filter`; a pill that turns a list filter on or off is `toggle`; a pill
   that runs or inserts something (a suggestion, a search topic, a formula
   field) is `secondary` sm with no active state.
   Variants with a selected state use the additive `hover-wash`, so the
   active tint stays under hover. Variants never inject icons.

   Sizes: sm = min-h-6 px-2 py-0.5 rounded-md; md = min-h-8 px-3 py-1.5
   rounded-lg; both label-sm. lg = min-h-11 px-4 py-2.5 label-md, only for a
   standalone full-width conversion CTA (pricing, checkout, the API card);
   a CTA beside an input stays md, level with the input. Heights are PADDING-DRIVEN, never fixed: every
   control in a row shares the same py, so mixed content lines up. `square`
   (icon-only) is p-0.5 / p-1.5. In a phone sheet's rows (`data-sheet`, the
   `sheet:` variant) md grows to 44px with a label-md label and a square md
   to 44x44; sm keeps its size. On touch screens `touch-target` gives every
   size an invisible 44px hit area. Never pin `h-*` or `size-*` on a button,
   and never put an sm control beside md ones.

   Icons: an icon beside a label is 14px (`size-3.5`); an icon-only square
   control uses 16px (`size-4`). An icon-only action beside text buttons
   reads better with a label, which also spares it the Tooltip an icon-only
   control needs.

   `className` is for LAYOUT PLACEMENT ONLY (ml-auto, w-full, shrink-0…),
   same contract as Card. Different colors or spacing are a new variant in
   this file, not a className override.

   Width: `min-w-fit` keeps the label from shrinking under the global
   `* { min-width: 0 }`, and a pending button keeps the wider of its idle and
   busy widths, so the row does not reflow while the action runs.

   The button is Ariakit's Button, so a disabled button keeps React Aria's
   model: `disabled` takes it out of the tab order, and two states keep it
   focusable (aria-disabled) while swallowing presses:
   - `pendingLabel`: while an action runs, pass its label ("Saving…"). The
     button shows a spinner and that label and is announced as busy, so it
     keeps focus and a form cannot submit twice through Enter either. It keeps
     full colour, unlike a disabled button, so it reads as working, even when
     a disabled <fieldset> around it also disables it (the `not-aria-busy`
     guards). Pass null once the action settles.
   - `accessibleWhenDisabled`: a control that disables itself when pressed (a
     stepper at its limit, Resend during its cooldown, a pager at its end),
     or a disabled icon-only control, so its Tooltip still names it; the
     reason it is disabled still shows in visible text.
   A pending button is never natively disabled, even when the caller also
   passes `disabled`, because a native disable drops focus to the page.
   Disabled controls dim to 60% and keep their fill on hover. Never a spinner
   without a label or a label without a spinner; an icon-only pending button
   shows the spinner alone and announces the label.
   Like Ariakit's, the button is type="button" unless it says otherwise: a
   submit button passes type="submit", so no other button submits by accident.
   Inside a dialog, any other focused control that disappears hands focus to
   the dialog's first control (catchLostFocus in src/ui/focus.ts).

   A form that locks its fields while a request runs wraps only the fields in
   `<fieldset disabled>`. The submit stays outside it (in DialogFooter, joined
   by `form=`), and the submit handler focuses `event.nativeEvent.submitter`,
   so Enter in a field leaves focus on the pending button and an error leaves
   the reader on the retry.

   For Ariakit hosts, prefer composing the component itself:
   <Ariakit.DialogDisclosure render={<Button size="md" />}>…</Ariakit.DialogDisclosure>
   (DialogDismiss, MenuButton, PopoverDisclosure, a Tooltip anchor alike).
   Never render it into `Ariakit.Button`: pass `disabled` and
   `accessibleWhenDisabled` to Button. A link is `<Button as={BasicLink}>`.
   The class builder is private on purpose: a component whose trigger is a
   button renders Button itself rather than taking a class for it.
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
	| 'overlay'
	| 'ghostDestructive'
type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
	secondary:
		'border border-medium text-primary not-disabled:not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row',
	primary:
		'border border-transparent bg-brand text-on-brand not-disabled:not-aria-disabled:hover:brightness-110 not-disabled:not-aria-disabled:focus-visible:brightness-110 focus-visible:focus-ring-on-brand',
	outline: 'border border-brand text-link not-disabled:not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row',
	destructive:
		'border border-error-muted text-error not-disabled:not-aria-disabled:hover:bg-error-muted focus-visible:bg-error-muted',
	ghost:
		'hover-wash border border-transparent data-[active=true]:bg-brand-muted data-[active=true]:text-link text-secondary not-disabled:not-aria-disabled:hover:text-primary focus-visible:text-primary',
	filter: 'hover-wash border border-brand text-primary data-[active=true]:bg-brand-muted',
	toggle:
		'hover-wash border border-medium bg-surface-elevated-1 text-primary data-[active=true]:border-brand data-[active=true]:bg-brand-muted data-[active=true]:text-link',
	metricBrowse: 'hover-wash border border-dashed border-brand bg-brand-muted text-primary',
	// Hidden until the pointer enters the rail or the arrow takes focus. A disabled arrow (at the rail's end) stays
	// hidden there too, because the disabled opacity-60 would otherwise outrank opacity-0.
	overlay:
		'hover-wash border border-medium bg-surface text-primary shadow-overlay-sm opacity-0 transition-opacity duration-120 group-hover/rail:opacity-100 focus-visible:opacity-100 aria-disabled:not-group-hover/rail:not-focus-visible:opacity-0',
	ghostDestructive:
		'border border-transparent text-secondary pointer-coarse:text-error not-disabled:not-aria-disabled:hover:bg-error-muted not-disabled:not-aria-disabled:hover:text-error focus-visible:bg-error-muted focus-visible:text-error'
}

const LINK_CLASSES =
	'touch-target inline-flex cursor-pointer items-center gap-1 text-link [text-transform:inherit] underline-offset-2 not-disabled:not-aria-disabled:hover:underline focus-visible:underline disabled:not-aria-busy:cursor-not-allowed disabled:not-aria-busy:opacity-60 aria-disabled:not-aria-busy:cursor-not-allowed aria-disabled:not-aria-busy:opacity-60 aria-busy:cursor-progress'

/* min-h pins the control heights (sm 24, md 32) so rows of
   mixed content (16px icons vs 16px text lines) stay exactly level; padding
   supplies the breathing room within. sm py is 0.5 (not 1) because label-sm's
   16px line + py-1 + border = 26px would overshoot the 24px floor — content
   must stay under min-h so the floor decides the height. A text md button in
   a phone sheet's rows is 44px with a 14px label (`sheet:`), level with the
   fields beside it and the footer below. An icon-only md button grows with it to 44x44, so a row
   never pairs a 44px text button with a 32px square; sm keeps its size there, and touch screens
   give every size a 44px touch target instead. */
const SIZE_CLASSES: Record<ButtonSize, string> = {
	sm: 'label-sm min-h-6 gap-1 px-2 py-0.5',
	md: 'label-sm min-h-8 gap-1 px-3 py-1.5 sheet:min-h-11 sheet:label-md',
	lg: 'label-md min-h-11 gap-1.5 px-4 py-2.5'
}

/** Icon-only buttons: aspect-square + self-center so flex rows can't stretch them. */
const SQUARE_SIZE_CLASSES: Record<ButtonSize, string> = {
	sm: 'aspect-square min-h-6 self-center p-0.5',
	md: 'aspect-square min-h-8 self-center p-1.5 sheet:min-h-11',
	lg: 'aspect-square min-h-11 self-center p-2.5'
}

const RADIUS_CLASSES: Record<ButtonSize, string> = {
	sm: 'rounded-md',
	md: 'rounded-lg',
	lg: 'rounded-lg'
}

/** A link has no size: it takes its type from the text around it. */
type ButtonLook =
	| { variant: 'link'; size?: never; square?: never }
	| { variant?: ButtonVariant; size: ButtonSize; square?: boolean }

function buttonStyles(look: ButtonLook): string {
	if (look.variant === 'link') return LINK_CLASSES
	const { variant = 'secondary', size, square = false } = look
	return `touch-target flex min-w-fit shrink-0 cursor-pointer items-center justify-center whitespace-nowrap disabled:not-aria-busy:cursor-not-allowed disabled:not-aria-busy:opacity-60 aria-disabled:not-aria-busy:cursor-not-allowed aria-disabled:not-aria-busy:opacity-60 aria-busy:cursor-progress ${
		square ? SQUARE_SIZE_CLASSES[size] : SIZE_CLASSES[size]
	} ${variant === 'filter' ? 'rounded-full' : RADIUS_CLASSES[size]} ${VARIANT_CLASSES[variant]}`
}

type ButtonProps<T extends ElementType> = ButtonLook & {
	/** A link or other host keeps its own element and role; only the default button takes button behaviour. */
	as?: T
	/** Set while the button's action runs; the button shows a spinner and this label, keeps focus and ignores presses.
	    Buttons only: a link (`as`) navigates and has nothing to wait on. */
	pendingLabel?: string | null
	/** For a control that disables itself when pressed (a stepper at its limit, Resend during its cooldown): it keeps
	    focus while disabled, so pressing it never drops focus to the page. Other disabled buttons leave the tab order. */
	accessibleWhenDisabled?: boolean
	'aria-disabled'?: boolean | 'true' | 'false'
	/** The selected state of ghost, filter and toggle buttons, or a filter picker whose popover is open. */
	'data-active'?: boolean | string
	/** Layout placement only (ml-auto, w-full, …) — never colors or spacing. */
	className?: string | undefined
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function Button<T extends ElementType = 'button'>(buttonProps: ButtonProps<T>) {
	const {
		as,
		variant: _variant,
		size: _size,
		square = false,
		pendingLabel = null,
		accessibleWhenDisabled = false,
		'data-active': dataActive,
		'aria-disabled': ariaDisabled,
		className,
		...props
	} = buttonProps
	const classes = `${buttonStyles(buttonProps)} ${className ?? ''}`.trim()
	if (as) {
		const Component = as as ElementType
		return <Component className={classes} data-active={dataActive} aria-disabled={ariaDisabled} {...props} />
	}
	const pending = pendingLabel !== null
	const children = pending ? (
		<PendingContent square={square} label={pendingLabel} idle={props.children} />
	) : (
		props.children
	)
	return (
		<Ariakit.Button
			className={classes}
			{...props}
			// Ariakit marks a press with data-active; here it means selected, so only the caller sets it.
			data-active={dataActive}
			aria-disabled={ariaDisabled}
			disabled={pending || props.disabled}
			// Ariakit keeps a disabled button focusable with aria-disabled and swallows its presses, including the click a
			// form's Enter key sends to its submit button, so a pending button holds focus and cannot submit twice.
			// An Ariakit host that renders this button (render={<Button />}) marks "disabled but focusable" with
			// aria-disabled alone, and a truly disabled one with both.
			accessibleWhenDisabled={
				pending || accessibleWhenDisabled || (!props.disabled && (ariaDisabled === true || ariaDisabled === 'true'))
			}
			aria-busy={pending || undefined}
		>
			{children}
		</Ariakit.Button>
	)
}

function PendingContent({ square, label, idle }: { square: boolean; label: string; idle: ReactNode }) {
	// An icon-only button has no room for a label: the spinner replaces the icon, the label is announced.
	if (square)
		return (
			<>
				<LoadingSpinner size={14} />
				<span className="sr-only">{label}</span>
			</>
		)
	// The idle content stays in the same grid cell, invisible and hidden from assistive tech, so the button keeps the
	// wider of its two widths and the row around it does not reflow while the action runs.
	return (
		<span className="grid">
			<span aria-hidden className="invisible col-start-1 row-start-1 flex items-center justify-center gap-1">
				{idle}
			</span>
			<span className="col-start-1 row-start-1 flex items-center justify-center gap-1">
				<LoadingSpinner size={14} />
				{label}
			</span>
		</span>
	)
}

/** A split button: a command and the menu that changes it ("Download CSV" and its format menu) share one outline.
    The children are primary Buttons of one size, the menu trigger `square` and last; the group squares the corners
    where they touch and draws a divider between them, so every height and touch target stays the Button recipe's.
    The menu is a MenuSurface with `Ariakit.MenuItemRadio` rows. */
export function ButtonGroup({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div
			role="group"
			aria-label={label}
			className="inline-flex *:not-first:rounded-l-none *:not-first:border-l-on-brand/25 *:not-last:rounded-r-none"
		>
			{children}
		</div>
	)
}
