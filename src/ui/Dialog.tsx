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
import { catchLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { tw } from './tw'

/* ----------------------------------------------------------------------------
   Dialog — the design.md popover/dialog surface recipe (stroke-medium,
   radius 12).

   Surface: below sm = bottom drawer (full width, rounded top, safe-area pad),
                       height fits content up to 85dvh;
            sm+      = centered card, height fits content up to 720px, width
            capped at --dialog-width (default 600px).
            Only the bottom edge is pinned below sm, so the sheet sizes to its
            content. `dialogFullSheetSurfaceStyles` keeps the full 85dvh sheet
            instead when the content changes height in use (search results,
            lists that load, filter rows). Below sm the sheet sits on top of
            the keyboard and caps its height to the space above it, through
            the vars useKeyboardInset publishes.
   Chrome:  header/footer rows bring their own `border-subtle` divider and
            px-4 py-3 section padding; title is DialogHeading (heading-xs);
            close × is a 32px ghost square Button with a 16px x icon; footer
            is <DialogFooter> with <Button size="md">Cancel</Button> +
            <Button variant="primary" size="md">Save/Done</Button>.
   Body:    the surface is overflow-hidden flex-col — give the scrolling
            region `min-h-0 flex-auto overflow-y-auto` and p-3 itself.

   `dialogSurfaceStyles` (bg-overlay) is the default for content dialogs —
   a single sheet of controls/text. `dialogCanvasSurfaceStyles`
   (bg-surface-elevated-1) is only for canvas dialogs that host white
   bg-surface cards inside them (currently: Metrics).

   Both are plain strings for Ariakit.Dialog's className. Width is LAYOUT
   and comes from the call site: append e.g. `[--dialog-width:448px]` —
   never override the surface colors/radius.
---------------------------------------------------------------------------- */

const dialogSurfaceBaseStyles =
	'fixed inset-(--inset) right-0 bottom-0 left-0 z-50 m-auto mb-0 flex max-h-(--sheet-height) w-full max-w-full flex-col overflow-hidden rounded-t-xl border border-medium pb-[max(0px,calc(env(safe-area-inset-bottom)-var(--keyboard-inset,0px)))] shadow-dialog [--sheet-height:min(85dvh,calc(var(--visual-viewport-height,100dvh)-3rem))] max-sm:bottom-(--keyboard-inset,0px) max-sm:drawer sm:top-0 sm:mb-auto sm:h-(--dialog-height,fit-content) sm:max-h-(--dialog-max-height,min(720px,calc(100%-32px))) sm:max-w-[min(calc(100%-32px),var(--dialog-width,600px))] sm:rounded-xl sm:pb-0 dark:shadow-dialog-deep sm:scale-[.98] sm:opacity-0 sm:transition-[opacity,scale] sm:duration-260 sm:ease-out-quart sm:data-enter:scale-100 sm:data-enter:opacity-100 sm:data-leave:duration-200'

export const dialogSurfaceStyles = `${dialogSurfaceBaseStyles} bg-overlay`

/** Below sm, keep the full sheet height, for content that changes height in use. */
export const dialogFullSheetSurfaceStyles = `${dialogSurfaceStyles} max-sm:h-(--sheet-height)`

/** Canvas dialogs only: hosts bg-surface cards on an elevated-1 backdrop. */
const dialogCanvasSurfaceStyles = `${dialogSurfaceBaseStyles} bg-surface-elevated-1`

/** Use a content basis so Safari includes the body when sizing a fit-content dialog. */
export const dialogScrollableBodyStyles = tw`min-h-0 flex-auto overflow-y-auto overscroll-contain`

/* ----------------------------------------------------------------------------
   Dialog / SideSheet — the surfaces as components. Pick a size, never an
   arbitrary --dialog-width:
     Dialog     sm 448 (confirms, short forms, lists) · md 600 (forms, pickers)
                · lg 880 (two-pane filters, rails, settings)
                · xl workspace: min(1280, 100% − 32) wide and a fixed
                  min(900, 100dvh − 32) tall, for self-contained editors
                  whose panes scroll on their own (Add card, SQL editor,
                  Downloads previews, Metrics). On phones a workspace is
                  the full sheet and brings its own layout, usually a
                  switch between its panes in the toolbar band.
     SideSheet  sm 448 (forms, filters) · md 672 (detail viewers)
                · lg 1152 (docs with a table of contents, history)
   Below sm both are bottom sheets: a Dialog hugs its content unless
   `fullSheet` or xl; a SideSheet always keeps the full sheet height.
   `canvas` gives either the elevated-1 fill for a body of bg-surface cards.

   `pending` locks the surface while a request that cannot be cancelled runs:
   Escape, an outside tap and the header × stop closing it. Callers still
   disable their own Cancel. A request that aborts on close does not need it.

   Contents: <DialogHeader> · optional <DialogToolbar> (search, tabs, steps)
   · <DialogBody> · optional <DialogFooter>.
---------------------------------------------------------------------------- */

/** A leave prompt: it receives the step that leaving would take (close the dialog, switch a tab) and runs it if
    the reader confirms. */
type LeaveGuard = (proceed: () => void) => void

/** The surface's lock (`pending`) and its leave guard, read by the ×, the back control and guarded tabs. */
const DialogSurfaceContext = createContext<{
	pending: boolean
	setGuard: (guard: LeaveGuard | null) => void
	/** Hands `proceed` to the guard and returns true when one is mounted; otherwise returns false. */
	attemptLeave: (proceed: () => void) => boolean
}>({ pending: false, setGuard: () => {}, attemptLeave: () => false })

type SurfaceDismissProps = Pick<SurfaceProps, 'pending' | 'hideOnEscape' | 'hideOnInteractOutside'>

/** The dismissal shared by Dialog and SideSheet: `pending` stops Escape, outside taps and the ×; a mounted
    DialogCloseGuard turns Escape and the × into its own prompt and ignores outside taps. The guard is read when the
    event happens, so it needs no render of the surface. */
function SurfaceDialog({
	pending = false,
	hideOnEscape = true,
	hideOnInteractOutside = true,
	ref,
	...props
}: SurfaceDismissProps & Omit<ComponentProps<typeof Ariakit.Dialog>, 'hideOnEscape' | 'hideOnInteractOutside'>) {
	const guardRef = useRef<LeaveGuard | null>(null)
	// A dialog under Ariakit.DialogProvider gets its store from context, not from a prop.
	const contextStore = Ariakit.useDialogContext()
	// Stable, so a render never resets the net in the commit that removes the focused control.
	const surfaceRef = useCallback(
		(node: HTMLDivElement | null) => {
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
	const surface = {
		pending,
		setGuard: (guard: LeaveGuard | null) => {
			guardRef.current = guard
		},
		attemptLeave: (proceed: () => void) => {
			if (!guardRef.current) return false
			guardRef.current(proceed)
			return true
		}
	}
	return (
		<DialogSurfaceContext value={surface}>
			<Ariakit.Dialog
				hideOnEscape={(event) => {
					// Leaving closes the way Escape would: through the caller's store, its onClose for a controlled dialog, or
					// the provider's store. onClose comes before the context, so a controlled dialog nested in another
					// dialog's provider never closes its parent.
					if (
						surface.attemptLeave(() => {
							if (props.store) props.store.hide()
							else if (props.onClose) props.onClose(new Event('close'))
							else contextStore?.hide()
						})
					)
						return false
					return !pending && (typeof hideOnEscape === 'function' ? hideOnEscape(event) : hideOnEscape)
				}}
				hideOnInteractOutside={(event) =>
					!guardRef.current &&
					!pending &&
					(typeof hideOnInteractOutside === 'function' ? hideOnInteractOutside(event) : hideOnInteractOutside)
				}
				{...props}
				ref={surfaceRef}
			/>
		</DialogSurfaceContext>
	)
}

export function DialogCloseGuard({ onAttemptLeave }: { onAttemptLeave: LeaveGuard }) {
	const { setGuard } = useContext(DialogSurfaceContext)
	return (
		<span
			hidden
			ref={(node) => {
				if (!node) return
				setGuard(onAttemptLeave)
				return () => setGuard(null)
			}}
		/>
	)
}

/** For a control inside a guarded dialog that leaves the current step, such as a tab: run `proceed` directly, or hand
    it to the mounted DialogCloseGuard to confirm first. */
export function useDialogLeave() {
	const { attemptLeave } = useContext(DialogSurfaceContext)
	return (proceed: () => void) => {
		if (!attemptLeave(proceed)) proceed()
	}
}

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl'
type SideSheetSize = Exclude<DialogSize, 'xl'>

/** Width (and, for a workspace, height) per size, also for a surface that is not a Dialog itself (a Suspense
    placeholder shaped like one). */
export const dialogWidthStyles: Record<DialogSize, string> = {
	sm: '[--dialog-width:448px]',
	md: '[--dialog-width:600px]',
	lg: '[--dialog-width:880px]',
	xl: '[--dialog-width:1280px] [--dialog-height:min(900px,calc(100dvh-32px))] [--dialog-max-height:none] max-sm:h-(--sheet-height)'
}

type SurfaceProps = {
	pending?: boolean
} & Omit<ComponentProps<typeof Ariakit.Dialog>, 'className'>

// Product token scopes: portalled dialogs sit outside the product's own root, so they re-apply its tokens.
const DIALOG_SCOPE = { pro: 'pro-dashboard' } as const

export function Dialog({
	size,
	fullSheet = false,
	canvas = false,
	scope,
	...props
}: SurfaceProps & {
	size: DialogSize
	fullSheet?: boolean
	/** Only for a body of bg-surface cards, like the Metrics browser. */
	canvas?: boolean
	scope?: keyof typeof DIALOG_SCOPE
}) {
	const surface = canvas
		? `${dialogCanvasSurfaceStyles} ${fullSheet ? 'max-sm:h-(--sheet-height)' : ''}`
		: fullSheet
			? dialogFullSheetSurfaceStyles
			: dialogSurfaceStyles
	return (
		<SurfaceDialog
			className={`${surface} ${dialogWidthStyles[size]} ${scope ? DIALOG_SCOPE[scope] : ''}`.trim()}
			{...props}
		/>
	)
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
	'fixed inset-x-0 bottom-(--keyboard-inset,0px) z-50 flex h-(--sheet-height) w-full flex-col overflow-hidden rounded-t-xl border border-medium pb-[max(0px,calc(env(safe-area-inset-bottom)-var(--keyboard-inset,0px)))] shadow-dialog [--sheet-height:min(85dvh,calc(var(--visual-viewport-height,100dvh)-3rem))] max-sm:drawer sm:inset-y-0 sm:right-0 sm:left-auto sm:h-auto sm:max-w-[min(var(--side-sheet-width),calc(100%-48px))] sm:translate-x-full sm:rounded-none sm:border-y-0 sm:border-r-0 sm:pb-0 sm:opacity-0 sm:transition-[translate,opacity] sm:duration-260 sm:ease-out-quart sm:data-enter:translate-x-0 sm:data-enter:opacity-100 sm:data-leave:duration-200 motion-reduce:transition-none dark:shadow-dialog-deep'

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
	const { pending, attemptLeave } = useContext(DialogSurfaceContext)
	const store = Ariakit.useDialogContext()!
	return (
		<Ariakit.DialogDismiss
			onClick={(event) => {
				// DialogDismiss skips its hide when the click is already handled; the guard hides once confirmed.
				if (attemptLeave(() => store.hide())) event.preventDefault()
			}}
			disabled={pending}
			accessibleWhenDisabled
			render={<Button type="button" variant="ghost" size="md" square className={`-mr-2 ${className ?? ''}`.trim()} />}
			aria-label={ariaLabel}
			{...props}
		>
			<Icon name="x" className="size-4" aria-hidden="true" />
		</Ariakit.DialogDismiss>
	)
}

/** The header's back control, mirroring DialogCloseButton on the left: its icon sits on the content edge. */
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
	return (
		<Button
			variant="ghost"
			size="md"
			square
			className="-ml-2"
			disabled={pending || disabled}
			accessibleWhenDisabled
			aria-label={label}
			onClick={onClick}
		>
			<Icon name="arrow-left" className="size-4" aria-hidden="true" />
		</Button>
	)
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
