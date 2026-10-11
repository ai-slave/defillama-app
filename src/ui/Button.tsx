import * as Ariakit from '@ariakit/react'
import type { ComponentPropsWithRef, ElementType, ReactNode } from 'react'
import { Icon } from './Icon'
import { LoadingSpinner } from './internal/Loaders'

/* ----------------------------------------------------------------------------
   Button — every action button. Callers choose `size`; `variant` defaults to
   secondary.

   Variants:
   - secondary:   transparent + border-medium (default toolbar/action button)
   - primary:     bg-brand + text-on-brand (one per view: Done, Sign-in, …;
                  a dismissible banner's single CTA, an empty state's CTA and
                  a repeated cell's Run may also be primary; so may two equal
                  alternatives side by side, such as the Sheets hero's
                  Google Sheets and Excel)
   - outline:     border-brand + text-link; hovers to its own blue tint
   - destructive: border-error-muted + text-error for irreversible actions;
                  hover and focus tint in its own red (bg-error-tint), never
                  the neutral row wash
   - ghostDestructive: a quiet icon-only delete in a dense row (trash on a
                  saved query, draft or preset); turns error red, on the
                  red wash, on hover, focus and touch screens. Red marks data loss only: unpin,
                  clear a selection or remove a filter stay ghost
   - ghost:       borderless quiet trigger; `data-active` gives it the
                  brand-muted fill and text-link
   - filter:      rounded-full brand-border pill; hovers to bg-brand-tint,
                  `data-active` selects it with bg-brand-muted (no hover).
                  Metrics-directory category filters and removable
                  active-filter pills (label + x) use `filter` size="sm";
                  never hand-roll the pill classes
   - toggle:      elevated neutral fill, brand border/tint/text-link
                  when `data-active`: toolbar filters and selectable options
                  (`stateIcon` shows that state as an icon, below)
   - metricBrowse: dashed brand pill in the home metrics browse toolbar
   - floating:    opaque overlay fill, border and menu shadow, always
                  visible: a control that floats over page content, such as
                  the Edit button pinned over a research article
   - overlay:     floating, plus its reveal, for a rail scroll arrow that
                  floats over scrolling content: hidden until the pointer
                  enters the `group/rail` container around it or it takes
                  focus. The call site passes placement only
   - onMedia:     a control laid over an image, a video or a dark scrim
                  (cover editor, carousel arrows): translucent dark
                  backdrop, white line and text, a light shadow. Round when
                  square. A toolbar that already draws its own frosted bar
                  over the picture holds ghost-like buttons instead
   - onBrand:     a control on the brand-blue mobile header: translucent
                  white fill, white icon. Header squares are lg (44px)
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
                  It is always underlined, softly at rest and solid on hover
                  and focus: the link blue is too close to body text for
                  color alone to mark it in a sentence. A disabled link's
                  underline is solid, in the disabled color.
   Pick a pill by its job: a removable active filter or a filter picker is
   `filter`; a pill that turns a list filter on or off is `toggle` (whether
   its value lives in the URL or in state is in docs/url-state.md); a pill
   that runs or inserts something (a suggestion, a search topic, a formula
   field) is `secondary` sm with no active state; LlamaAI question strips
   use md, keeping their 32px row.
   Variants with a selected state use the additive `hover-wash`, so the
   active tint stays under hover. Variants never inject icons.
   `stateIcon` (toggle and filter pills that add or remove something, such
   as newsletter picks): Button draws a 14px plus when off and a check when
   on, from `data-active`, in one slot before the label. The pill keeps its
   width when picked, so nothing after it moves; never render the check only
   when on.
   `doneLabel` with `done` (Copy → Copied, Share → Copied): pass the label
   always and set `done` while it shows. Button draws a check and the label
   in the same grid cell as the idle content, both always laid out, so the
   button keeps one width in both states and its neighbours never move.
   A button whose own label switches with a mode (Edit ↔ Done, Show ↔ Hide)
   renders `<StableLabel labels={['Edit', 'Done']} current={…} />` as its
   children, which lays every label out in one cell the same way.
   Never swap a Button's text by hand.

   Pressed: while held down, every variant goes one ramp step past its hover
   (the neutral wash deepens, a tint goes to step 5, primary darkens), with no
   scale or movement, so a tap shows on touch screens, which have no hover.
   A selected or disabled button takes no pressed step.

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
   `* { min-width: 0 }`, except with `truncate`, where a pill in a shared row
   shrinks and its label (in a `truncate` span) ends in an ellipsis, and a button with a `pendingLabel` is always as wide
   as the wider of its idle and busy labels, at rest too, so "Save" never
   grows into "Saving…" and the row does not reflow when the action starts.

   The button is Ariakit's Button, so a disabled button keeps React Aria's
   model: `disabled` takes it out of the tab order, and two states keep it
   focusable (aria-disabled) while swallowing presses:
   - `pendingLabel` with `pending`: pass the busy label always ("Saving…")
     and set `pending` while the action runs. The button shows a spinner and
     that label and is announced as busy, so it keeps focus and a form cannot
     submit twice through Enter either. It keeps full colour, unlike a
     disabled button, so it reads as working, even when a disabled
     <fieldset> around it also disables it (the `not-aria-busy` guards).
   - `accessibleWhenDisabled`: a control that disables itself when pressed (a
     stepper at its limit, Resend during its cooldown, a pager at its end),
     or a disabled icon-only control, so its Tooltip still names it; the
     reason it is disabled still shows in visible text.
   A pending button is never natively disabled, even when the caller also
   passes `disabled`, because a native disable drops focus to the page.
   Disabled controls dim to 60% and keep their fill on hover. Never a spinner
   without a label or a label without a spinner; an icon-only pending button
   shows the spinner alone and announces the label. An export button in a
   toolbar row (.csv, .png) takes `pending` without a `pendingLabel` and swaps
   its icon for `BusyGlyph decorative`: its label stays, so it keeps the width
   of its neighbours while it works.
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
	| 'floating'
	| 'overlay'
	| 'onMedia'
	| 'onBrand'
	| 'ghostDestructive'
type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
	secondary:
		'border border-medium text-primary not-disabled:not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row not-disabled:not-aria-disabled:active:bg-pressed-row',
	primary:
		'border border-transparent bg-brand text-on-brand not-disabled:not-aria-disabled:hover:brightness-110 not-disabled:not-aria-disabled:focus-visible:brightness-110 not-disabled:not-aria-disabled:active:brightness-90 focus-visible:focus-ring-on-brand',
	outline:
		'border border-brand text-link not-disabled:not-aria-disabled:hover:bg-brand-tint focus-visible:bg-brand-tint not-disabled:not-aria-disabled:active:bg-brand-tint-pressed',
	destructive:
		'border border-error-muted text-error not-disabled:not-aria-disabled:hover:bg-error-tint focus-visible:bg-error-tint not-disabled:not-aria-disabled:active:bg-error-tint-pressed',
	ghost:
		'hover-wash border border-transparent data-[active=true]:bg-brand-muted data-[active=true]:text-link text-secondary not-data-[active=true]:not-disabled:not-aria-disabled:hover:text-primary not-data-[active=true]:focus-visible:text-primary',
	filter:
		'border border-brand text-primary not-data-[active=true]:not-disabled:not-aria-disabled:hover:bg-brand-tint not-data-[active=true]:focus-visible:bg-brand-tint not-data-[active=true]:not-disabled:not-aria-disabled:active:bg-brand-tint-pressed data-[active=true]:bg-brand-muted',
	toggle:
		'hover-wash border border-medium bg-surface-elevated-1 text-primary data-[active=true]:border-brand data-[active=true]:bg-brand-muted data-[active=true]:text-link',
	metricBrowse:
		'border border-dashed border-brand bg-brand-tint text-primary not-disabled:not-aria-disabled:hover:bg-brand-tint-strong focus-visible:bg-brand-tint-strong not-disabled:not-aria-disabled:active:bg-brand-tint-pressed',
	floating: 'hover-wash border border-medium bg-overlay text-primary shadow-overlay',
	// Floating, hidden until the pointer enters the rail or the arrow takes focus.
	overlay:
		'hover-wash border border-medium bg-overlay text-primary shadow-overlay opacity-0 transition-opacity duration-120 group-hover/rail:opacity-100 focus-visible:opacity-100',
	onMedia:
		'border border-media-control bg-media-control text-media-control shadow-raised backdrop-blur-sm not-disabled:not-aria-disabled:hover:bg-media-control-hover focus-visible:bg-media-control-hover not-disabled:not-aria-disabled:active:bg-media-control-pressed',
	onBrand:
		'border border-transparent bg-on-brand-control text-on-brand shadow-raised not-disabled:not-aria-disabled:hover:bg-on-brand-control-hover focus-visible:bg-on-brand-control-hover focus-visible:focus-ring-on-brand not-disabled:not-aria-disabled:active:bg-on-brand-control-pressed',
	ghostDestructive:
		'border border-transparent text-secondary pointer-coarse:text-error not-disabled:not-aria-disabled:hover:bg-error-tint not-disabled:not-aria-disabled:hover:text-error focus-visible:bg-error-tint focus-visible:text-error not-disabled:not-aria-disabled:active:bg-error-tint-pressed'
}

/* Every variant disables to one neutral look (design.md → Color ramps): disabled text, plus the disabled fill on
   filled variants and the disabled border on outlined ones, never the variant's own colors at reduced opacity.
   A pending button (aria-busy) keeps its look. */
const DISABLED_TEXT = 'disabled:not-aria-busy:text-disabled aria-disabled:not-aria-busy:text-disabled'
const DISABLED_FILL = 'disabled:not-aria-busy:bg-disabled aria-disabled:not-aria-busy:bg-disabled'
const DISABLED_BORDER = 'disabled:not-aria-busy:border-disabled aria-disabled:not-aria-busy:border-disabled'
// Controls on a picture or the blue header keep their translucent fill and dim their white text (and line) instead:
// the neutral disabled text would vanish on a dark scrim.
const DISABLED_ON_BRAND =
	'disabled:not-aria-busy:text-media-control-disabled aria-disabled:not-aria-busy:text-media-control-disabled'
const DISABLED_ON_MEDIA = `${DISABLED_ON_BRAND} disabled:not-aria-busy:border-media-control-disabled aria-disabled:not-aria-busy:border-media-control-disabled`
const DISABLED_CLASSES: Record<ButtonVariant, string> = {
	secondary: DISABLED_BORDER,
	primary: DISABLED_FILL,
	outline: DISABLED_BORDER,
	destructive: DISABLED_BORDER,
	ghost: '',
	filter: DISABLED_BORDER,
	toggle: `${DISABLED_FILL} ${DISABLED_BORDER}`,
	metricBrowse: `${DISABLED_FILL} ${DISABLED_BORDER}`,
	floating: DISABLED_BORDER,
	overlay: DISABLED_BORDER,
	onMedia: DISABLED_ON_MEDIA,
	onBrand: DISABLED_ON_BRAND,
	ghostDestructive: ''
}

const LINK_CLASSES =
	'touch-target inline-flex cursor-pointer items-center gap-1 text-link [text-transform:inherit] underline decoration-link-underline underline-offset-2 not-disabled:not-aria-disabled:hover:decoration-current focus-visible:decoration-current disabled:not-aria-busy:decoration-current aria-disabled:not-aria-busy:decoration-current disabled:not-aria-busy:cursor-not-allowed disabled:not-aria-busy:text-disabled aria-disabled:not-aria-busy:cursor-not-allowed aria-disabled:not-aria-busy:text-disabled aria-busy:cursor-progress'

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

/** Icon-only buttons: aspect-square + self-center so flex rows can't stretch them, and w-fit so a block parent such
    as a table cell can't either: a block-level flex box fills its parent's width, and the ratio then sets its height. */
const SQUARE_SIZE_CLASSES: Record<ButtonSize, string> = {
	sm: 'aspect-square min-h-6 w-fit self-center p-0.5',
	md: 'aspect-square min-h-8 w-fit self-center p-1.5 sheet:min-h-11',
	lg: 'aspect-square min-h-11 w-fit self-center p-2.5'
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

function buttonStyles(look: ButtonLook, truncate: boolean): string {
	if (look.variant === 'link') return LINK_CLASSES
	const { variant = 'secondary', size, square = false } = look
	return `touch-target flex ${truncate ? 'min-w-0' : 'min-w-fit shrink-0'} cursor-pointer items-center justify-center whitespace-nowrap disabled:not-aria-busy:cursor-not-allowed aria-disabled:not-aria-busy:cursor-not-allowed aria-busy:cursor-progress ${variant === 'onMedia' || variant === 'onBrand' ? '' : DISABLED_TEXT} ${DISABLED_CLASSES[variant]} ${
		square ? SQUARE_SIZE_CLASSES[size] : SIZE_CLASSES[size]
	} ${variant === 'filter' || (variant === 'onMedia' && square) ? 'rounded-full' : RADIUS_CLASSES[size]} ${VARIANT_CLASSES[variant]}`
}

type ButtonProps<T extends ElementType> = ButtonLook & {
	/** A link or other host keeps its own element and role; only the default button takes button behaviour. */
	as?: T
	/** The label shown with a spinner while `pending` ("Saving…"). Passed always, so the button reserves its width at
	    rest. Buttons only: a link (`as`) navigates and has nothing to wait on. */
	pendingLabel?: string
	/** Set while the button's action runs: it shows `pendingLabel`, keeps focus and ignores presses. */
	pending?: boolean
	/** For a control that disables itself when pressed (a stepper at its limit, Resend during its cooldown): it keeps
	    focus while disabled, so pressing it never drops focus to the page. Other disabled buttons leave the tab order. */
	accessibleWhenDisabled?: boolean
	'aria-disabled'?: boolean | 'true' | 'false'
	/** The selected state of ghost, filter and toggle buttons, or a filter picker whose popover is open. */
	'data-active'?: boolean | string
	/** Draw the selected state as a plus or a check before the label, in one slot that keeps the width. */
	stateIcon?: boolean
	/** A short success label ("Copied") shown with a check while `done`; the button keeps the wider width throughout. */
	doneLabel?: string
	done?: boolean
	/** Let the button shrink below its label, which then ends in an ellipsis: a row of suggestion pills that share one
	    line. The text to cut goes in `<span className="truncate">`; an icon beside it stays whole. */
	truncate?: boolean
	/** Layout placement only (ml-auto, w-full, …) — never colors or spacing. */
	className?: string | undefined
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function Button<T extends ElementType = 'button'>(buttonProps: ButtonProps<T>) {
	const {
		as,
		variant: _variant,
		size: _size,
		square = false,
		pendingLabel,
		pending = false,
		accessibleWhenDisabled = false,
		'data-active': dataActive,
		'aria-disabled': ariaDisabled,
		stateIcon = false,
		doneLabel,
		done = false,
		truncate = false,
		className,
		...props
	} = buttonProps
	const classes = `${buttonStyles(buttonProps, truncate)} ${className ?? ''}`.trim()
	const idleContent = stateIcon ? (
		<>
			<Icon name={dataActive === true || dataActive === 'true' ? 'check' : 'plus'} className="size-3.5" aria-hidden />
			{props.children}
		</>
	) : (
		props.children
	)
	const content =
		doneLabel === undefined ? (
			idleContent
		) : (
			<SameCell
				shown={done ? 1 : 0}
				states={[
					idleContent,
					<>
						<Icon name="check" className="size-3.5" aria-hidden />
						{doneLabel}
					</>
				]}
			/>
		)
	if (as) {
		const Component = as as ElementType
		return (
			<Component className={classes} data-active={dataActive} aria-disabled={ariaDisabled} {...props}>
				{content}
			</Component>
		)
	}
	const children =
		pendingLabel === undefined ? (
			content
		) : square ? (
			// An icon-only button has no room for a label: the spinner replaces the icon, the label is announced.
			pending ? (
				<>
					<LoadingSpinner size={14} />
					<span className="sr-only">{pendingLabel}</span>
				</>
			) : (
				content
			)
		) : pending ? (
			<SameCell
				shown={1}
				states={[
					content,
					<>
						<LoadingSpinner size={14} />
						{pendingLabel}
					</>
				]}
			/>
		) : (
			<span className="grid gap-inherit">
				<span className="col-start-1 row-start-1 flex items-center justify-center gap-inherit">{content}</span>
				<ReservedLabel label={pendingLabel} icon />
			</span>
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

/** Every state stays laid out in one grid cell and only the shown one is visible and announced, so the button is
    always as wide as its widest state and nothing beside it moves when the state changes. */
function SameCell({ states, shown }: { states: ReadonlyArray<ReactNode>; shown: number }) {
	return (
		<span className="grid gap-inherit">
			{states.map((state, index) => (
				<span
					// oxlint-disable-next-line react/no-array-index-key -- The states are a fixed list in a fixed order.
					key={index}
					aria-hidden={index === shown ? undefined : true}
					className={`col-start-1 row-start-1 flex items-center justify-center gap-inherit ${index === shown ? '' : 'invisible'}`}
				>
					{state}
				</span>
			))}
		</span>
	)
}

/** Holds the width of a label that is not shown without putting its text in the page: an invisible pseudo-element
    draws it, so it stays out of the text, the accessible name and find-in-page. `icon` adds the 14px icon slot
    beside it (the busy spinner). */
export function ReservedLabel({ label, icon = false }: { label: string; icon?: boolean }) {
	return (
		<span
			aria-hidden
			data-label={label}
			className="invisible col-start-1 row-start-1 flex items-center justify-center gap-inherit before:content-[attr(data-label)]"
		>
			{icon ? <span className="size-3.5" /> : null}
		</span>
	)
}

/** A label that switches with a mode (Edit ↔ Done): the others are reserved in the same cell, so the button holds the
    width of the longest. */
export function StableLabel<L extends string>({ labels, current }: { labels: ReadonlyArray<L>; current: L }) {
	return (
		<span className="grid gap-inherit">
			<span className="col-start-1 row-start-1 flex items-center justify-center">{current}</span>
			{labels.map((label) => (label === current ? null : <ReservedLabel key={label} label={label} />))}
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
			className="inline-flex *:not-first:rounded-l-none *:not-first:border-l-on-brand-seam *:not-last:rounded-r-none"
		>
			{children}
		</div>
	)
}
