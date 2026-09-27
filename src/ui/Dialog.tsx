import * as Ariakit from '@ariakit/react'
import { Children, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { Button } from '~/ui/Button'
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
	'fixed inset-(--inset) right-0 bottom-0 left-0 z-50 m-auto mb-0 flex max-h-(--sheet-height) w-full max-w-full flex-col overflow-hidden rounded-t-xl border border-medium pb-[max(0px,calc(env(safe-area-inset-bottom)-var(--keyboard-inset,0px)))] shadow-dialog [--sheet-height:min(85dvh,calc(var(--visual-viewport-height,100dvh)-3rem))] max-sm:bottom-[var(--keyboard-inset,0px)] max-sm:drawer sm:top-0 sm:mb-auto sm:h-fit sm:max-h-[min(720px,calc(100%-32px))] sm:max-w-[min(calc(100%-32px),var(--dialog-width,600px))] sm:rounded-xl sm:pb-0 dark:shadow-dialog-deep sm:scale-[.98] sm:opacity-0 sm:transition-[opacity,scale] sm:duration-260 sm:ease-out-quart sm:data-enter:scale-100 sm:data-enter:opacity-100 sm:data-leave:duration-200'

export const dialogSurfaceStyles = `${dialogSurfaceBaseStyles} bg-overlay`

/** Below sm, keep the full sheet height, for content that changes height in use. */
export const dialogFullSheetSurfaceStyles = `${dialogSurfaceStyles} max-sm:h-(--sheet-height)`

/** Canvas dialogs only: hosts bg-surface cards on an elevated-1 backdrop. */
export const dialogCanvasSurfaceStyles = `${dialogSurfaceBaseStyles} bg-surface-elevated-1`

/** Use a content basis so Safari includes the body when sizing a fit-content dialog. */
export const dialogScrollableBodyStyles = tw`min-h-0 flex-auto overflow-y-auto overscroll-contain`

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
	return (
		<Ariakit.DialogDismiss
			render={
				<Button
					type="button"
					variant="ghost"
					size="md"
					square
					// Below sm the x is the only visible dismiss, so its hit area grows to 44px without changing the 32px look.
					className={`relative -mr-2 max-sm:before:absolute max-sm:before:-inset-1.5 max-sm:before:content-[''] ${className ?? ''}`.trim()}
				/>
			}
			aria-label={ariaLabel}
			{...props}
		>
			<Icon name="x" className="size-4" aria-hidden="true" />
		</Ariakit.DialogDismiss>
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
		<footer className="mt-auto flex shrink-0 flex-wrap items-center gap-2 border-t border-subtle bg-overlay px-4 py-3">
			{leading ? <div className="flex items-center gap-2 max-sm:[&>button]:min-h-11">{leading}</div> : null}
			<div className="ml-auto flex flex-1 items-center justify-end gap-2 sm:flex-none">
				{/* With no commit action beside it, Cancel stays visible so the row is never empty on phones. */}
				{dismiss ? (
					<div className={`flex ${hasActions ? 'max-sm:hidden' : 'flex-1 *:flex-1 max-sm:*:min-h-11 sm:flex-none'}`}>
						{dismiss}
					</div>
				) : null}
				<div className="flex flex-1 items-center gap-2 *:flex-1 max-sm:*:min-h-11 sm:flex-none sm:*:flex-none">
					{children}
				</div>
			</div>
		</footer>
	)
}
