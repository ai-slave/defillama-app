import type { CSSProperties, ReactNode } from 'react'
import type { QueryRetry } from '~/utils/query'
import { Button } from './Button'
import { Card } from './Card'
import { focusRegionOnLeave } from './focus'
import { Icon, type IIcon } from './Icon'
import { LoadingIndicator, LoadingSpinner } from './internal/Loaders'

/* ----------------------------------------------------------------------------
   Loading, empty and error states.

   | Where                                       | Use                                         |
   | ------------------------------------------- | ------------------------------------------- |
   | A whole panel is the state                  | PanelStatus, PanelLoadingStatus             |
   | Inside a Panel, Card, chart or dialog body  | SurfaceBodyStatus, SurfaceBodyLoadingStatus |
   | A message in a dialog or above content      | InlineStatus (error, warning, empty)        |
   | An error with no room for a box             | ErrorLine (menu rows, toolbars, chips)      |
   | Loading over content that stays visible     | SurfaceLoadingOverlay                       |
   | Nothing here yet, or nothing matched        | EmptyState (icon, title, hint, actions)     |
   | An empty result in a list, popover, table   | NoResults (./NoResults.tsx)                 |
   | Loading rows in a list or popover           | ListLoading (./NoResults.tsx)               |
   | Loading inline in a row, field or line      | InlineLoading                               |
   | A row, chip, tab or line busy with its work | BusyGlyph, `decorative` inside a control    |
   | A busy button                               | Button `pending` (./Button.tsx)             |

   - Loading always shows on the surface that holds the content, through
     these parts. The dots, spinner and indicator they draw live in
     ./internal/Loaders.tsx, which an oxlint import rule keeps out of app
     code, so a page cannot assemble a loading state of its own.
     A loading state never sits on the bare page background. A Suspense or
     `dynamic()` fallback is a loading state too: the part for its surface
     with a label naming what loads, never a blank min-h box. A body that
     reserves its box while nothing is in it yet (a checkout frame)
     places SurfaceBodyLoadingStatus with `absolute inset-0 min-h-0`.
   - Copy is text-center body-sm: loading and empty text-tertiary, error
     text-error with role="alert". InlineStatus draws its own box (below). Ad-hoc placeholders use the same
     tokens; never raw `text-red-*` or text-primary for "No results found".
   - Shells reserve space with min-h: 360px by default, 400px for a lazy
     chart that renders its own export toolbar, larger only when the route's
     chart or table shape needs it. The 360px is an `initial:` default, so
     a caller's min-h-* always wins.
   - A request's error renders where its data would be, as one of these
     states, never as a toast from an effect watching `.error`. Read it with
     `queryReadFailed` from src/utils/query.ts (nothing to show and it failed)
     and check it before loading; a refetch that fails over data on screen is
     `queryRefreshFailed`, a notice beside the data, never the error in its place;
     PanelStatus, SurfaceBodyStatus and InlineStatus take
     the query as `retry` and draw its Try again (RetryButton); never place
     one by hand inside a status. See docs/focus-and-errors.md for retries.
   - scripts/policies/check-status-parts.ts refuses hand-built loading text,
     error boxes, alert lines, a retry gated on isError instead of
     queryReadFailed, and a Suspense or `dynamic()` fallback that renders a
     blank box.
---------------------------------------------------------------------------- */

export type StatusVariant = 'loading' | 'empty' | 'error'

// Loading has its own parts (PanelLoadingStatus, SurfaceBodyLoadingStatus) that draw the animated LoadingIndicator;
// the text statuses take only empty and error, so a loading state can never render as bare "Loading" text.
type TextStatusVariant = Exclude<StatusVariant, 'loading'>

const STATUS_TEXT = {
	empty: 'text-tertiary',
	error: 'text-error'
} as const

type PanelStatusProps = {
	children: ReactNode
	variant: TextStatusVariant
	/** The query whose failure this is: its Try again waits while the read runs again, and hands focus to the page
	    content when what loads replaces the panel. */
	retry?: QueryRetry
	className?: string
}

export function PanelStatus({ children, variant, retry, className }: PanelStatusProps) {
	const role = variant === 'error' ? 'alert' : 'status'

	return (
		<Card
			padding="sm"
			className={`flex flex-1 flex-col items-center justify-center gap-2 initial:min-h-[360px] ${className ?? ''}`.trim()}
		>
			<p
				role={role}
				aria-live={variant === 'error' ? undefined : 'polite'}
				className={`text-center body-sm ${STATUS_TEXT[variant]}`}
			>
				{children}
			</p>
			{retry ? <RetryButton retry={retry} /> : null}
		</Card>
	)
}

/** The Try again of a failed read, drawn by the status parts that take `retry`: it waits while the read runs again,
    and hands focus to the region around it when what loads replaces the status. */
function RetryButton({ retry }: { retry: QueryRetry }) {
	return (
		<Button
			ref={focusRegionOnLeave}
			size="sm"
			onClick={() => void retry.refetch()}
			pendingLabel="Retrying…"
			pending={retry.isFetching}
		>
			Try again
		</Button>
	)
}

// A dialog's request error renders at the end of its scrolling body while the button that caused it sits in the
// footer, so on a phone it can appear below the fold. `nearest` leaves an error already in view where it is.
// Page errors never scroll: moving the page under the reader is worse than an error they scroll to.
function bringDialogErrorIntoView(node: HTMLDivElement | null) {
	if (node?.closest('[role=dialog],[role=alertdialog]')) node.scrollIntoView({ block: 'nearest' })
}

const INLINE_STATUS = {
	error: { box: 'border-error-muted bg-error-faint text-primary', icon: 'circle-x', iconColor: 'text-error' },
	warning: {
		box: 'border-warning-muted bg-warning-faint text-primary',
		icon: 'alert-triangle',
		iconColor: 'text-warning'
	},
	empty: { box: 'border-medium bg-surface-elevated-1 text-tertiary', icon: null, iconColor: '' },
	info: { box: 'border-medium bg-surface-elevated-1 text-primary', icon: null, iconColor: '' }
} as const

/** A message in a dialog or above content: a request that failed, a caveat, an empty note, a neutral notice (`info`:
    a protocol renamed its site, a default the reader can change) in primary text. Error and warning take
    their tinted box and status icon, so the two never differ by colour alone; the message stays primary text. The
    icon sits centred on the first line (`h-lh`), so a wrapped message keeps it beside its opening words. `action` is
    the one sm Button that answers it (Try again, Renew); with it, icon and text centre on that button's 24px row.
    A failed read passes its query as `retry` instead: the part draws that Try again, waiting while the read runs again
    and handing focus to the region around it when what loads replaces the notice (a dialog's own net catches it there).
    A field's own error is never an InlineStatus: Field draws it under the field. Where the failed part already draws
    its own error (the Turnstile widget), the line under it is a body-sm text-secondary hint instead of a second box. */
export function InlineStatus({
	children,
	variant,
	action,
	retry
}: {
	children: ReactNode
	variant: 'empty' | 'error' | 'warning' | 'info'
	action?: ReactNode
	retry?: QueryRetry
}) {
	const shownAction = retry ? <RetryButton retry={retry} /> : action
	const { box, icon, iconColor } = INLINE_STATUS[variant]
	// The first line drops by half of what the 24px action row adds over one line of text.
	const firstLine = shownAction ? 'mt-[calc((1.5rem_-_1lh)/2)]' : ''
	return (
		<div
			// Attached only while the status is an error, so a status that turns into one in place scrolls too.
			ref={variant === 'error' ? bringDialogErrorIntoView : undefined}
			role={variant === 'error' ? 'alert' : 'status'}
			className={`flex gap-2 rounded-lg border px-3 body-sm ${shownAction ? 'py-1.5' : 'py-2'} ${box}`}
		>
			{icon ? (
				<span className={`flex h-lh shrink-0 items-center ${firstLine}`}>
					<Icon name={icon} className={`size-4 ${iconColor}`} aria-hidden />
				</span>
			) : null}
			<div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-1">
				<div className={`min-w-0 ${firstLine}`}>{children}</div>
				{shownAction}
			</div>
		</div>
	)
}

const ERROR_LINE_INSET = { none: '', menuRow: 'px-3 py-2' } as const

/** A request error where InlineStatus's box has no room: a menu, a toolbar, a chip row, a dialog footer beside its
    buttons. The red icon marks it as an error, as in InlineStatus, and the message stays primary text. `menuRow` gives
    it a popover row's padding (./Popover.ts), so it lines up with the rows above it. */
export function ErrorLine({ children, inset }: { children: ReactNode; inset: keyof typeof ERROR_LINE_INSET }) {
	return (
		<p role="alert" className={`flex gap-1.5 body-sm text-primary ${ERROR_LINE_INSET[inset]}`.trim()}>
			<span className="flex h-lh shrink-0 items-center">
				<Icon name="circle-x" className="size-3.5 text-error" aria-hidden />
			</span>
			<span className="min-w-0">{children}</span>
		</p>
	)
}

/** Loading inline in a row, field or line (a setting's value, a field's options, a step's check): the quiet
    indicator with a label naming what loads, announced. Where the caller keeps one live region around content that
    changes in place (a step whose "Checking your payment" turns into its outcome), `insideLiveRegion` drops the part's
    own role, so that region announces the label once and a nested region never repeats it. Rows of a list or popover
    loading are ListLoading; a panel, card, chart or dialog body loading is SurfaceBodyLoadingStatus. */
export function InlineLoading({ label, insideLiveRegion = false }: { label: string; insideLiveRegion?: boolean }) {
	return (
		<span
			role={insideLiveRegion ? undefined : 'status'}
			aria-live={insideLiveRegion ? undefined : 'polite'}
			className="flex"
		>
			<LoadingIndicator label={label} />
		</span>
	)
}

/** A row, chip, tab or line busy with its own work while it stays on screen (a saved query running, a file
    uploading, an autosave): the spinner and `label` naming the work ("Saving…", "Adding to queue"). The label shows
    beside the spinner in the line's own type and colour; `hideLabel` keeps it for screen readers only where there is
    no room (an icon slot, a chip), so the spinner is never unlabelled. The part announces itself; `insideLiveRegion`
    drops the role where the caller's own region already announces the change.
    Inside a control (a button, link, tab, menu item, combobox option, summary, a Card as a button), or beside text
    that already names the work, the glyph is `decorative`: the bare spinner, aria-hidden, with no role and no label.
    A label there would join the control's name ("Query running Stop query") and nest a live region in a control. The
    control's own text or aria-label names the work ("Signing in…"), the control keeps `aria-busy`, and a status region
    beside it announces the work where the change needs announcing. A busy button with room for a label is Button
    `pending` with `pendingLabel`.
    `size` matches what it stands in for: 12 beside body-sm or label-sm text and in a 12-16px slot, 14 in place of a
    size-3.5 icon, 18 in place of a size-5 tile icon.
    Content still loading is one of the loading parts above, never this. */
export function BusyGlyph(
	props: { size: 12 | 14 | 18 } & (
		| { decorative?: false; label: ReactNode; hideLabel?: boolean; insideLiveRegion?: boolean }
		| { decorative: true }
	)
) {
	// `in` narrows the union under strict: false, where a check on the optional `decorative` flag does not.
	if (!('label' in props)) {
		return (
			<span aria-hidden className="flex shrink-0">
				<LoadingSpinner size={props.size} />
			</span>
		)
	}
	const { label, size, hideLabel = false, insideLiveRegion = false } = props
	return (
		<span
			role={insideLiveRegion ? undefined : 'status'}
			aria-live={insideLiveRegion ? undefined : 'polite'}
			className="flex items-center gap-1.5"
		>
			<LoadingSpinner size={size} />
			<span className={hideLabel ? 'sr-only' : 'min-w-0'}>{label}</span>
		</span>
	)
}

export function SurfaceLoadingOverlay({ label }: { label: string }) {
	return (
		<div
			role="status"
			aria-live="polite"
			className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-veil backdrop-blur-[1px]"
		>
			<div className="flex items-center gap-2 rounded-lg border border-medium bg-surface-elevated-1 px-3 py-2 body-sm text-secondary shadow-raised">
				<LoadingSpinner size={12} />
				<span>{label}</span>
			</div>
		</div>
	)
}

export function PanelLoadingStatus({ label = 'Loading', className }: { label?: string; className?: string }) {
	return (
		<Card
			padding="sm"
			className={`flex flex-1 flex-col items-center justify-center initial:min-h-[360px] ${className ?? ''}`.trim()}
		>
			<div role="status" aria-live="polite" className="flex items-center justify-center">
				<LoadingIndicator label={label} />
			</div>
		</Card>
	)
}

type SurfaceBodyStatusProps = {
	children: ReactNode
	variant: TextStatusVariant
	/** The query whose failure this is, as on PanelStatus. Its Try again waits while the query refetches; when what
	    loads replaces the status, focus moves to the page content rather than dropping to the document. */
	retry?: QueryRetry
	className?: string
	style?: CSSProperties
}

/* The body parts fill the body they sit in (`flex-auto`; a 0 basis would drop a caller's `h-*` in a column sized by
   its content) and centre themselves in it (`m-auto`), so a slot that is not a stretching flex column (a grid cell, an
   items-start column, a `max-w-*` box) still shows the state in its middle.
   `className` and `style` take the slot's size where it differs from the 360px default (min-h-0, h-*), so the page does
   not jump when one state replaces another. Children render as one text block; several blocks (a sentence and a
   button) bring their own flex wrapper. */
export function SurfaceBodyStatus({ children, variant, retry, className, style }: SurfaceBodyStatusProps) {
	const role = variant === 'error' ? 'alert' : 'status'

	return (
		// The inset keeps the text off a narrow body's edges; a body that brings its own padding replaces it.
		<div
			className={`m-auto flex flex-auto flex-col items-center justify-center gap-2 initial:min-h-[360px] initial:p-4 ${className ?? ''}`.trim()}
			style={style}
		>
			<div
				role={role}
				aria-live={variant === 'error' ? undefined : 'polite'}
				className={`text-center body-sm ${STATUS_TEXT[variant]}`}
			>
				{children}
			</div>
			{retry ? <RetryButton retry={retry} /> : null}
		</div>
	)
}

export function SurfaceBodyLoadingStatus({
	label = 'Loading',
	className,
	style
}: {
	label?: string
	className?: string
	style?: CSSProperties
}) {
	return (
		<div
			className={`m-auto flex flex-auto items-center justify-center initial:min-h-[360px] ${className ?? ''}`.trim()}
			style={style}
		>
			<div role="status" aria-live="polite" className="flex items-center justify-center">
				<LoadingIndicator label={label} />
			</div>
		</div>
	)
}

const EMPTY_STATE_SIZE = {
	md: {
		box: 'gap-3 px-4 py-8',
		disc: 'size-10',
		icon: 'size-5',
		text: 'gap-1',
		title: 'label-lg',
		hint: 'max-w-sm body-sm text-tertiary'
	},
	lg: {
		box: 'gap-4 px-6 py-12',
		disc: 'size-14',
		icon: 'size-6',
		text: 'gap-1.5',
		title: 'heading-sm',
		hint: 'max-w-md body-md text-secondary'
	}
} as const

/** Where content would be and there is none: nothing created yet (no dashboards, no API key), nothing matched with a
    way back (Clear filters), a choice to make first (pick a token), or a locked feature (Sign in, Upgrade). Not an error, which
    keeps PanelStatus or InlineStatus so it reads as broken, and not a quick no-match inside a table, list or popover,
    which is NoResults. A one-line note inside a chart or panel body stays SurfaceBodyStatus.
    `md` sits inside a Panel, Card or dialog body and takes sm buttons; `lg` fills a page or tab and takes md buttons,
    with at most one primary. The icon sits in a neutral disc. `framed` draws a dashed well where a card, a grid of
    cards or a list would sit with no surface of its own (the page, a canvas dialog body); inside the Panel or Card that
    holds the content it draws no frame. `actions` holds the buttons, or the picker or form that fills the space; the
    hint is inline text. The title is a <p>; `headingAs` makes it a heading when it stands in for the page's or tab's
    own (a gated page's h1). `className` places it (min-h, height, grid area), never restyles it. Copy invites rather
    than apologises: the title names the space with no closing period, the hint says how it fills and ends with one. */
export function EmptyState({
	size,
	icon,
	title,
	children,
	actions,
	framed,
	headingAs: Title = 'p',
	className
}: {
	size: keyof typeof EMPTY_STATE_SIZE
	icon?: IIcon['name']
	title: ReactNode
	/** The hint under the title. */
	children?: ReactNode
	actions?: ReactNode
	framed?: boolean
	headingAs?: 'p' | 'h1' | 'h2' | 'h3'
	className?: string
}) {
	const s = EMPTY_STATE_SIZE[size]
	return (
		<div
			className={`flex flex-1 flex-col items-center justify-center text-center ${s.box} ${framed ? 'rounded-lg border border-dashed border-medium' : ''} ${className ?? ''}`}
		>
			{icon ? (
				<span
					className={`flex shrink-0 items-center justify-center rounded-full border border-subtle bg-surface-elevated-1 text-tertiary ${s.disc}`}
				>
					<Icon name={icon} className={s.icon} aria-hidden />
				</span>
			) : null}
			<div role="status" aria-live="polite" className={`flex flex-col items-center ${s.text}`}>
				<Title className={`text-balance text-primary ${s.title}`}>{title}</Title>
				{children ? <p className={s.hint}>{children}</p> : null}
			</div>
			{actions ? <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
		</div>
	)
}
