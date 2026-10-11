import * as Ariakit from '@ariakit/react'
import {
	Children,
	createContext,
	useCallback,
	useContext,
	useRef,
	useState,
	type ComponentProps,
	type ComponentPropsWithoutRef,
	type ReactNode
} from 'react'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { catchLostFocus, pageContent } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { tw } from './tw'

/* ----------------------------------------------------------------------------
   Dialog — modal surfaces: Dialog, SideSheet, and ConfirmDialog
   (./ConfirmDialog.tsx). Build new dialogs from these components, not the
   class strings; a raw Ariakit.Dialog passes `ref={catchLostFocus}`. Never
   reuse the popover drawer helpers for a task dialog.

   Surface: below sm, a bottom sheet (full width, rounded top corners, no
            bottom radius, safe-area pad) that hugs its content up to
            `--sheet-height` (src/tailwind.css). `fullSheet` keeps the full
            sheet height when the content changes height in use (search
            results, lists that load, suggestions that appear as you type,
            filter rows you add); everything else hugs, forms included.
            The sheet sits on top of the iOS keyboard: useKeyboardInset
            (mounted once in _app) publishes --keyboard-inset and
            --visual-viewport-height, which set its bottom offset and height
            cap, so it shrinks above the keyboard and scrolls inside.
            From sm, a centered card that fits its content up to
            min(720px, 100% − 32px). Never patch sheet height per dialog.
   Mount:   pass `unmountOnHide`, so a closed dialog leaves the DOM. A dialog
            kept mounted to keep its state between opens (Ariakit's default,
            or `unmountOnHide={false}`) renders its content only
            once `useDeferredValue(true, false) || open` holds, so it is never
            built inside hydration. A heavy body renders behind one more
            deferred value, as the Metrics grid does: an early tap paints the
            header and search first, and the body fills in during the fade.
   Fill:    bg-overlay. `canvas` gives the elevated-1 fill, only for a body
            of bg-surface cards. Emphasis boxes inside a content dialog use
            bg-surface-elevated-1; an empty state is EmptyState (src/ui/Status.tsx).
   Rows:    DialogToolbar, DialogBody, DialogFooter and a drawer's
            PopoverHeader search carry `data-sheet`. Below sm, controls in
            them take a 44px floor through the `sheet:` variant: fields,
            select triggers, md buttons (a square md grows to 44x44) and
            padded segmented controls. sm controls keep their size, and the
            header keeps 32px controls. The rule reaches every descendant,
            shared page parts included; never pin `h-*` or `size-*` on a
            control, so a row never mixes heights.
---------------------------------------------------------------------------- */

const dialogSurfaceBaseStyles =
	'fixed inset-(--inset) right-0 bottom-0 left-0 z-50 m-auto mb-0 flex max-h-(--sheet-height) w-full max-w-full flex-col overflow-hidden rounded-t-xl border border-medium pb-[max(0px,calc(env(safe-area-inset-bottom)-var(--keyboard-inset,0px)))] shadow-dialog max-sm:bottom-(--keyboard-inset,0px) max-sm:drawer sm:top-0 sm:mb-auto sm:h-(--dialog-height,fit-content) sm:max-h-(--dialog-max-height,min(720px,calc(100%-32px))) sm:max-w-[min(calc(100%-32px),var(--dialog-width,600px))] sm:rounded-xl sm:pb-0  sm:scale-[.98] sm:opacity-0 sm:transition-[opacity,scale] sm:duration-260 sm:ease-out-quart sm:data-enter:scale-100 sm:data-enter:opacity-100 sm:data-leave:duration-200'

export const dialogSurfaceStyles = `${dialogSurfaceBaseStyles} bg-overlay`

/** Below sm, keep the full sheet height, for content that changes height in use. */
const dialogFullSheetSurfaceStyles = `${dialogSurfaceStyles} max-sm:h-(--sheet-height)`

/** Canvas dialogs only: hosts bg-surface cards on an elevated-1 backdrop. */
const dialogCanvasSurfaceStyles = `${dialogSurfaceBaseStyles} bg-surface-elevated-1`

/** Use a content basis so Safari includes the body when sizing a fit-content dialog. */
export const dialogScrollableBodyStyles = tw`min-h-0 flex-auto overflow-y-auto overscroll-contain`

/* ----------------------------------------------------------------------------
   Dialog / SideSheet sizes. Pick a size, never an arbitrary --dialog-width
   (the `arbitrary-dialog-width` rule in check-design-tokens.mjs):
     Dialog     sm 448 (confirms, short forms, lists) · md 600 (forms, pickers)
                · lg 880 (two-pane filters, rails, settings)
                · xl 1280, up to min(900, 100% − 32) tall, for wide viewers
                  that fit their content
                · xl + `workspace`: a fixed min(900, 100dvh − 32) tall, for
                  self-contained editors and viewers whose panes scroll on
                  their own, so a pane that changes never resizes the
                  dialog. On phones a workspace is the full sheet and brings
                  its own layout, usually a switch between its panes in the
                  toolbar band, never its desktop panes stacked.
     SideSheet  sm 448 (forms, filters) · md 672 (detail viewers)
                · lg 1152 (docs with a table of contents, history)
   Below sm both are bottom sheets: a Dialog hugs its content unless
   `fullSheet` or a workspace; a SideSheet always keeps the full sheet height.
   A two-pane sheet shows one pane at a time below md (the list, or the
   pick's detail with a DialogBackButton); every switch goes through
   `keepFocus` from ./focus.ts.

   `pending` locks the surface while a request that cannot be cancelled runs:
   Escape, an outside tap, the header × and DialogCancelButton stop closing
   it. A request that aborts on close does not need it.

   Contents:
     <DialogHeader>   56px row (min-h-14 px-4 py-2.5) with a divider: an
                      optional `leading` control (DialogBackButton, a 32px
                      icon tile), heading-xs title, optional body-sm subtitle,
                      and the × unless closable={false}. A palette uses
                      <DialogSearchHeader>: the search field takes the
                      title's place, which stays for screen readers.
     <DialogToolbar>  optional band for search, tabs or steps.
     <DialogBody>     `content` p-4 with 16px between blocks, `list` p-2,
                      `flush` for panes and bodies that own their layout.
                      Third-party widgets (Turnstile) fill the row like the
                      fields around them.
     <DialogFooter>   every action row; never a hand-rolled one. Leading
                      actions (Clear all, a status line) far left, `dismiss`
                      (Cancel) next, the primary action last. One row at
                      every width; see its JSDoc for the phone layout.
   Confirmations use ConfirmDialog: no ×, Cancel kept at every width,
   role="alertdialog" only when the choice is destructive or irreversible.
   ConfirmActionDialog wraps it for a delete-style mutation.

   Behavior:
   - A dialog that would drop work on close mounts DialogDiscardGuard with
     `when` true while the draft differs from a snapshot of what it opened
     with, never a "touched" flag. Its footer Cancel is DialogCancelButton;
     never write a Cancel that decides for itself whether to ask.
   - Reset steps when the dialog opens, never in its close handler: key the
     stateful child by `useOpeningKey(open)`, so the fade-out keeps the last
     step on screen and a reopened dialog starts fresh.
   - A form dialog focuses its first field with Ariakit's autoFocus
     (`Ariakit.Focusable autoFocus render={<Input />}`); otherwise it starts
     on the ×. A picker's search autofocuses on desktop only, so a phone
     does not open its keyboard over the list.
   - Escape on an open picker closes only the picker: every picker trigger
     is ComboboxSelectTrigger, so a second Escape closes the dialog.
   - Pending buttons, errors, focus handoff and success steps follow
     docs/focus-and-errors.md.
---------------------------------------------------------------------------- */

/** A leave prompt: it receives the step that leaving would take (close the dialog, switch a tab) and runs it if
    the reader confirms. */
type LeaveGuard = (proceed: () => void) => void

type DialogSurface = {
	pending: boolean
	/** Closes this surface. Inside a TabPanel the nearest Ariakit dialog context is the panel's own store, so a control
	    that closes the dialog uses this instead. */
	close: () => void
	setGuard: (guard: LeaveGuard | null) => void
	/** Hands `proceed` to the guard and returns true when one is mounted; otherwise returns false. */
	attemptLeave: (proceed: () => void) => boolean
	/** Whether the surface is still open, for a step that may have closed it. */
	isOpen: () => boolean
	/** Focuses the caller's finalFocus, else the control that opened the surface, else the page content. For a guard's
	    Discard that closes the surface: Ariakit skips its own return while focus sits on Discard, outside the surface. */
	returnFocus: () => void
}

// What a raw Ariakit.Dialog's children read: nothing locks or guards it, and its own store closes it.
const NO_SURFACE: DialogSurface = {
	pending: false,
	close: () => {},
	attemptLeave: () => false,
	setGuard: () => {},
	isOpen: () => false,
	returnFocus: () => {}
}

/** The surface's lock (`pending`), its close and its leave guard, read by the ×, Cancel, the back control and guarded
    tabs. */
const DialogSurfaceContext = createContext<DialogSurface>(NO_SURFACE)

type SurfaceDismissProps = Pick<SurfaceProps, 'pending' | 'hideOnEscape' | 'hideOnInteractOutside'>

/** Where focus goes when a surface closes. Ariakit hands over the trigger (or finalFocus) only while it can still take
    focus. Once an update removed it, focus goes to the page content instead of the body. Under a dialog that is still
    open the page is inert, so the focus call does nothing and that dialog's own net (catchLostFocus) catches it. */
function returnFocusOnHide(trigger: HTMLElement | null) {
	if (trigger) return true
	pageContent()?.focus()
	return false
}

/** The dismissal shared by Dialog and SideSheet: `pending` stops Escape, outside taps and the ×; a mounted
    DialogDiscardGuard turns Escape and the × into its own prompt and ignores outside taps. The guard is read when the
    event happens, so it needs no render of the surface. */
function SurfaceDialog({
	pending = false,
	hideOnEscape = true,
	hideOnInteractOutside = true,
	autoFocusOnHide = returnFocusOnHide,
	ref,
	...props
}: SurfaceDismissProps & Omit<ComponentProps<typeof Ariakit.Dialog>, 'hideOnEscape' | 'hideOnInteractOutside'>) {
	const guardRef = useRef<LeaveGuard | null>(null)
	// A dialog under Ariakit.DialogProvider gets its store from context, not from a prop.
	const contextStore = Ariakit.useDialogContext()
	const nodeRef = useRef<HTMLDivElement | null>(null)
	// The control focus came from when it entered the surface: the one that opened it (the click capture below makes
	// that the pressed button in Safari and Firefox too). Recorded per opening, as a surface may stay mounted.
	const openerRef = useRef<HTMLElement | null>(null)
	// Stable, so a render never resets the net in the commit that removes the focused control.
	const surfaceRef = useCallback(
		(node: HTMLDivElement | null) => {
			nodeRef.current = node
			const release = catchLostFocus(node)
			if (typeof ref === 'function') ref(node)
			else if (ref) ref.current = node
			return () => {
				release?.()
				if (typeof ref === 'function') ref(null)
				else if (ref) ref.current = null
			}
		},
		[ref]
	)
	// Leaving closes the way Escape would: through the caller's store, its onClose for a controlled dialog, or the
	// provider's store. onClose comes before the context, so a controlled dialog nested in another dialog's provider
	// never closes its parent.
	const close = () => {
		if (props.store) props.store.hide()
		else if (props.onClose) props.onClose(new Event('close'))
		else contextStore?.hide()
	}
	const surface = {
		pending,
		close,
		setGuard: (guard: LeaveGuard | null) => {
			guardRef.current = guard
		},
		attemptLeave: (proceed: () => void) => {
			if (!guardRef.current) return false
			guardRef.current(proceed)
			return true
		},
		isOpen: () => !!nodeRef.current?.hasAttribute('data-open'),
		returnFocus: () => {
			const { finalFocus } = props
			const named = finalFocus instanceof HTMLElement ? finalFocus : finalFocus?.current
			const opener = openerRef.current
			const target = named?.isConnected
				? named
				: opener instanceof HTMLElement && opener.isConnected
					? opener
					: pageContent()
			target?.focus()
		}
	}
	return (
		<DialogSurfaceContext value={surface}>
			<Ariakit.Dialog
				hideOnEscape={(event) => {
					// A locked surface never asks: there is nothing to leave until the request settles.
					if (pending) return false
					if (surface.attemptLeave(close)) return false
					return typeof hideOnEscape === 'function' ? hideOnEscape(event) : hideOnEscape
				}}
				hideOnInteractOutside={(event) =>
					!guardRef.current &&
					!pending &&
					(typeof hideOnInteractOutside === 'function' ? hideOnInteractOutside(event) : hideOnInteractOutside)
				}
				autoFocusOnHide={autoFocusOnHide}
				{...props}
				onFocusCapture={(event) => {
					// Not focus coming back from inside: from the surface itself, or from a dialog stacked over it in its portal.
					const from = event.relatedTarget
					const dialog = event.currentTarget
					if (
						from instanceof HTMLElement &&
						!dialog.contains(from) &&
						!document.getElementById(dialog.dataset.dialogPortal ?? '')?.contains(from)
					)
						openerRef.current = from
					props.onFocusCapture?.(event)
				}}
				onClickCapture={(event) => {
					// Safari and Firefox on macOS leave focus where it was when a button is clicked. A dialog that the click
					// opens takes the focused element as its trigger, often this surface's ×, and returns focus there on close
					// instead of to the button or the caller's target. So the button takes focus first, as in Chrome. Focus in a
					// text field stays: a button beside one (clear, show password) acts on the field.
					const control = (event.target as Element).closest('button, a[href]')
					const active = document.activeElement
					if (
						control instanceof HTMLElement &&
						control !== active &&
						!active?.matches('input, textarea, [contenteditable]')
					)
						control.focus()
					props.onClickCapture?.(event)
				}}
				ref={surfaceRef}
			/>
		</DialogSurfaceContext>
	)
}

/** Asks before the dialog drops work: while `when` holds, Escape, the ×, DialogCancelButton, DialogBackButton and
    useDialogLeave steps open a confirmation that runs the step only on its confirm, and an outside tap does nothing. */
export function DialogDiscardGuard({
	when,
	title,
	description,
	confirmLabel = 'Discard',
	cancelLabel = 'Keep editing'
}: {
	when: boolean
	title: string
	description: ReactNode
	confirmLabel?: string
	cancelLabel?: string
}) {
	const { setGuard, isOpen, returnFocus } = useContext(DialogSurfaceContext)
	// The step that leaving would take (close the dialog, switch a tab), held while the reader confirms it.
	const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
	return (
		<>
			{when ? (
				<span
					hidden
					ref={(node) => {
						if (!node) return
						setGuard((proceed) => setPendingLeave(() => proceed))
						return () => setGuard(null)
					}}
				/>
			) : null}
			<ConfirmDialog
				open={pendingLeave !== null}
				onClose={() => setPendingLeave(null)}
				portal
				unmountOnHide
				autoFocusOnHide={(trigger) => {
					if (isOpen()) return returnFocusOnHide(trigger)
					// Discard closed the guarded surface, taking the control that asked (its ×, a field) with it.
					returnFocus()
					return false
				}}
				title={title}
				description={description}
				confirmLabel={confirmLabel}
				cancelLabel={cancelLabel}
				error={null}
				onConfirm={() => {
					const proceed = pendingLeave!
					setPendingLeave(null)
					proceed()
				}}
			/>
		</>
	)
}

/** For a control inside a guarded dialog that leaves the current step, such as a tab: run `proceed` directly, or hand
    it to the mounted DialogDiscardGuard to confirm first. */
export function useDialogLeave() {
	const { attemptLeave } = useContext(DialogSurfaceContext)
	return (proceed: () => void) => {
		if (!attemptLeave(proceed)) proceed()
	}
}

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl'
type SideSheetSize = Exclude<DialogSize, 'xl'>

/** Width per size, also for a surface that is not a Dialog itself (a Suspense placeholder shaped like one). */
export const dialogWidthStyles: Record<DialogSize, string> = {
	sm: '[--dialog-width:448px]',
	md: '[--dialog-width:600px]',
	lg: '[--dialog-width:880px]',
	xl: '[--dialog-width:1280px] [--dialog-max-height:min(900px,calc(100%-32px))]'
}

/** The workspace height: fixed on desktop and the full sheet on phones, so panes that change never resize it. */
export const dialogWorkspaceStyles =
	'[--dialog-height:min(900px,calc(100dvh-32px))] [--dialog-max-height:none] max-sm:h-(--sheet-height)'

type SurfaceProps = {
	pending?: boolean
} & Omit<ComponentProps<typeof Ariakit.Dialog>, 'className'>

export function Dialog({
	size,
	fullSheet = false,
	canvas = false,
	workspace = false,
	onClosed,
	...props
}: SurfaceProps & {
	size: DialogSize
	fullSheet?: boolean
	/** With `xl`: a fixed height for an editor whose panes scroll themselves. */
	workspace?: boolean
	/** Only for a body of bg-surface cards, like the Metrics browser. */
	canvas?: boolean
	/** For a controlled dialog (`open` and `onClose`): runs once the exit animation has ended, for a caller that keeps
	    heavy content mounted until then. */
	onClosed?: () => void
}) {
	const surface = canvas
		? `${dialogCanvasSurfaceStyles} ${fullSheet ? 'max-sm:h-(--sheet-height)' : ''}`
		: fullSheet
			? dialogFullSheetSurfaceStyles
			: dialogSurfaceStyles
	const className = `${surface} ${dialogWidthStyles[size]} ${workspace ? dialogWorkspaceStyles : ''}`.trim()
	return onClosed ? (
		<ClosedReportingSurfaceDialog className={className} onClosed={onClosed} {...props} />
	) : (
		<SurfaceDialog className={className} {...props} />
	)
}

/** A controlled surface on its own store, the only way Ariakit reports the end of the exit animation. */
function ClosedReportingSurfaceDialog({
	open,
	onClose,
	onClosed,
	...props
}: ComponentProps<typeof SurfaceDialog> & { onClosed: () => void }) {
	const store = Ariakit.useDialogStore({
		open,
		setOpen: (next) => {
			if (!next) onClose?.(new Event('close'))
		},
		// Ariakit reports mounted = false once the exit animation ends, never on a first render that starts closed.
		setMounted: (mounted) => {
			if (!mounted) onClosed()
		}
	})
	return <SurfaceDialog store={store} {...props} />
}

/** A key that changes each time `open` turns true. Key a dialog's stateful component by it instead of resetting
    its steps in the close handler: every opening starts fresh, and a closing dialog keeps its last step on screen
    through the fade-out. */
export function useOpeningKey(open: boolean) {
	const [opening, setOpening] = useState({ open, key: 0 })
	if (opening.open !== open) setOpening({ open, key: open ? opening.key + 1 : opening.key })
	return opening.key
}

const SIDE_SHEET_WIDTH: Record<SideSheetSize, string> = {
	sm: '[--side-sheet-width:448px]',
	md: '[--side-sheet-width:672px]',
	lg: '[--side-sheet-width:1152px]'
}

// Below sm: the same bottom sheet as a full-height Dialog. From sm: pinned to the right edge at full
// height, sliding in with the dialog's timing.
const sideSheetStyles =
	'fixed inset-x-0 bottom-(--keyboard-inset,0px) z-50 flex h-(--sheet-height) w-full flex-col overflow-hidden rounded-t-xl border border-medium pb-[max(0px,calc(env(safe-area-inset-bottom)-var(--keyboard-inset,0px)))] shadow-dialog max-sm:drawer sm:inset-y-0 sm:right-0 sm:left-auto sm:h-auto sm:max-w-[min(var(--side-sheet-width),calc(100%-48px))] sm:translate-x-full sm:rounded-none sm:border-y-0 sm:border-r-0 sm:pb-0 sm:opacity-0 sm:transition-[translate,opacity] sm:duration-260 sm:ease-out-quart sm:data-enter:translate-x-0 sm:data-enter:opacity-100 sm:data-leave:duration-200 motion-reduce:transition-none '

export function SideSheet({
	size,
	canvas = false,
	...props
}: SurfaceProps & {
	size: SideSheetSize
	/** Only for a body of bg-surface cards, like the canvas dialog. */
	canvas?: boolean
}) {
	return (
		<SurfaceDialog
			className={`${sideSheetStyles} ${canvas ? 'bg-surface-elevated-1' : 'bg-overlay'} ${SIDE_SHEET_WIDTH[size]}`}
			{...props}
		/>
	)
}

/** The title row: an optional leading control (DialogBackButton, a 32px icon tile), the heading, an optional
    body-sm subtitle, a workspace's own actions (Run, Copy, Download; a phone folds the secondary ones into a menu),
    and the × (confirmations pass closable={false}). */
export function DialogHeader({
	title,
	subtitle,
	leading,
	actions,
	closable = true
}: {
	title: ReactNode
	subtitle?: ReactNode
	leading?: ReactNode
	actions?: ReactNode
	closable?: boolean
}) {
	return (
		<header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-subtle px-4 py-2.5">
			{leading}
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<DialogHeading className="break-words">{title}</DialogHeading>
				{subtitle ? (
					<Ariakit.DialogDescription className="body-sm text-secondary">{subtitle}</Ariakit.DialogDescription>
				) : null}
			</div>
			{actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
			{closable ? <DialogCloseButton /> : null}
		</header>
	)
}

/** The header row of a palette: the search field takes the title's place, which stays for screen readers. */
export function DialogSearchHeader({ title, children }: { title: string; children: ReactNode }) {
	return (
		<header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-subtle px-4 py-2.5">
			<DialogHeading className="sr-only">{title}</DialogHeading>
			<div className="min-w-0 flex-1 *:w-full">{children}</div>
			<DialogCloseButton />
		</header>
	)
}

/** A band under the header for search, tabs or steps. */
export function DialogToolbar({ children }: { children: ReactNode }) {
	return (
		<div data-sheet className="shrink-0 border-b border-subtle px-4 py-3">
			{children}
		</div>
	)
}

const DIALOG_BODY_KIND = {
	content: 'flex flex-col gap-4 p-4',
	list: 'p-2',
	flush: ''
} as const

/** The scrolling body. content: p-4 with 16px between blocks; list: p-2, rows bring their own inset;
    flush: no padding, for panes, tables and bodies that own their layout. */
export function DialogBody({
	kind = 'content',
	children
}: {
	kind?: keyof typeof DIALOG_BODY_KIND
	children: ReactNode
}) {
	return (
		<div data-sheet className={`${dialogScrollableBodyStyles} ${DIALOG_BODY_KIND[kind]}`.trim()}>
			{children}
		</div>
	)
}

type DialogHeadingProps = {
	/** Layout placement only — the type/color comes from the recipe. */
	className?: string
} & Omit<ComponentPropsWithoutRef<'h2'>, 'className'>

/** Ariakit-wired dialog title (aria-labelledby), rendered as an h2 heading-xs. */
export function DialogHeading({ className, ...props }: DialogHeadingProps) {
	return (
		<Ariakit.DialogHeading render={<h2 />} className={`heading-xs text-primary ${className ?? ''}`.trim()} {...props} />
	)
}

type DialogCloseButtonProps = Omit<ComponentPropsWithoutRef<typeof Ariakit.DialogDismiss>, 'children' | 'render'> & {
	/** Layout placement only, e.g. `ml-auto`. The 16px icon sits 8px inside its 32px
	    ghost button, so the default `-mr-2` puts the icon edge on the content edge. */
	className?: string
	ariaLabel?: string
}

export function DialogCloseButton({ className, ariaLabel = 'Close dialog', ...props }: DialogCloseButtonProps) {
	const surface = useContext(DialogSurfaceContext)
	return (
		<Ariakit.DialogDismiss
			onClick={(event) => {
				// A raw Ariakit.Dialog has no surface, so DialogDismiss hides its store.
				if (surface === NO_SURFACE) return
				// The surface closes the dialog itself: inside a TabPanel, DialogDismiss would hide the panel. A mounted
				// guard closes it once confirmed.
				event.preventDefault()
				if (!surface.attemptLeave(surface.close)) surface.close()
			}}
			disabled={surface.pending}
			accessibleWhenDisabled
			render={<Button type="button" variant="ghost" size="md" square className={`-mr-2 ${className ?? ''}`.trim()} />}
			aria-label={ariaLabel}
			{...props}
		>
			<Icon name="x" className="size-4" aria-hidden="true" />
		</Ariakit.DialogDismiss>
	)
}

/** The footer's Cancel: it closes the way the × does, through a mounted DialogDiscardGuard, and is disabled while the
    surface is pending. Name the safe choice when "Cancel" would be ambiguous, e.g. "Keep editing". */
export function DialogCancelButton({ children = 'Cancel' }: { children?: ReactNode }) {
	const { pending, close } = useContext(DialogSurfaceContext)
	const leave = useDialogLeave()
	return (
		<Button size="md" disabled={pending} accessibleWhenDisabled onClick={() => leave(close)}>
			{children}
		</Button>
	)
}

/** The header's back control, mirroring DialogCloseButton on the left: its icon sits on the content edge. Like Cancel,
    it leaves through a mounted DialogDiscardGuard, so a step with work in it asks before Back drops it. */
export function DialogBackButton({
	label,
	onClick,
	disabled = false
}: {
	label: string
	onClick: () => void
	/** For a step whose own request is pending while the dialog itself stays closable. */
	disabled?: boolean
}) {
	const { pending } = useContext(DialogSurfaceContext)
	const leave = useDialogLeave()
	return (
		<Tooltip
			content={label}
			render={
				<Button
					variant="ghost"
					size="md"
					square
					className="-ml-2"
					disabled={pending || disabled}
					accessibleWhenDisabled
					aria-label={label}
					onClick={() => leave(onClick)}
				/>
			}
		>
			<Icon name="arrow-left" className="size-4" aria-hidden="true" />
		</Tooltip>
	)
}

/** A refused submit's reason, shown for as long as the draft is the one that was refused: any edit makes a new draft
    and clears it. Record the draft the refusal describes, which may differ from the rendered one when the submit
    adapted it. */
export function useRefusal<Draft>(draft: Draft) {
	const [refusal, setRefusal] = useState<{ draft: Draft; reason: string } | null>(null)
	return [refusal?.draft === draft ? refusal.reason : null, setRefusal] as const
}

type DialogFooterProps = {
	/** Far-left actions or a status line, such as Clear all. */
	leading?: ReactNode
	/** The Cancel control. It hides below sm, where the sheet's × and a tap outside already dismiss it;
	    confirmation dialogs pass Cancel as a child instead, so it stays at every width. */
	dismiss?: ReactNode
	/** The commit actions, primary last. Below sm they fill the rest of the row. May be empty. */
	children?: ReactNode
}

/** Dialog action row, one row at every width: leading actions left, Cancel and the primary action right.
    It pins to the bottom of the sheet (mt-auto), so a full-height typing sheet never floats it mid-screen.
    Below sm the primary actions grow to fill the row and every action is 44px tall, Apple's minimum
    touch target; the row wraps only when labels do not fit. */
export function DialogFooter({ leading, dismiss, children }: DialogFooterProps) {
	const hasActions = Children.toArray(children).length > 0
	return (
		<footer data-sheet className="mt-auto flex shrink-0 flex-wrap items-center gap-2 border-t border-subtle px-4 py-3">
			{leading ? <div className="flex min-w-0 items-center gap-2 max-sm:[&>button]:min-h-11">{leading}</div> : null}
			{/* min-w-fit keeps the global `min-width: 0` from squeezing the actions below their labels: when the row runs
			    out of room, the leading slot wraps onto its own line instead. */}
			<div className="ml-auto flex min-w-fit flex-1 items-center justify-end gap-2 sm:flex-none">
				{/* With no commit action beside it, Cancel stays visible so the row is never empty on phones. */}
				{dismiss ? (
					<div className={`flex ${hasActions ? 'max-sm:hidden' : 'flex-1 *:flex-1 max-sm:*:min-h-11 sm:flex-none'}`}>
						{dismiss}
					</div>
				) : null}
				<div className="flex min-w-fit flex-1 items-center gap-2 *:flex-1 max-sm:*:min-h-11 sm:flex-none sm:*:flex-none">
					{children}
				</div>
			</div>
		</footer>
	)
}
