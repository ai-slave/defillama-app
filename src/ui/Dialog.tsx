import * as Ariakit from '@ariakit/react'
import type { ComponentPropsWithoutRef } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { tw } from './tw'

/* ----------------------------------------------------------------------------
   Dialog — the design.md popover/dialog surface recipe (stroke-medium,
   radius 12).

   Surface: below sm = bottom drawer (full width, rounded top, safe-area pad);
            sm+      = centered card, height fits content up to 720px, width
            capped at --dialog-width (default 600px).
   Chrome:  header/footer rows bring their own `border-subtle` divider and
            p-3 (12px) section padding; title is DialogHeading (heading-xs);
            close × is a 32px ghost square Button with a 16px x icon; footer
            is <Button size="md">Cancel</Button> +
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
	'fixed inset-(--inset) top-0 right-0 bottom-0 left-0 z-50 m-auto mb-0 flex max-h-[85dvh] min-h-[40dvh] w-full max-w-full flex-col overflow-hidden rounded-t-xl border border-medium pb-[max(0px,env(safe-area-inset-bottom))] shadow-dialog max-sm:drawer sm:mb-auto sm:h-fit sm:max-h-[min(720px,calc(100%-32px))] sm:min-h-[initial] sm:max-w-[min(calc(100%-32px),var(--dialog-width,600px))] sm:rounded-xl sm:pb-0 dark:shadow-dialog-deep sm:scale-[.98] sm:opacity-0 sm:transition-[opacity,scale] sm:duration-260 sm:ease-out-quart sm:data-enter:scale-100 sm:data-enter:opacity-100 sm:data-leave:duration-200'

export const dialogSurfaceStyles = `${dialogSurfaceBaseStyles} bg-overlay`

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
	/** Layout placement only, e.g. `ml-auto` or `-mr-1`. */
	className?: string
	ariaLabel?: string
}

export function DialogCloseButton({ className, ariaLabel = 'Close dialog', ...props }: DialogCloseButtonProps) {
	return (
		<Ariakit.DialogDismiss
			render={<Button type="button" variant="ghost" size="md" square className={className} />}
			aria-label={ariaLabel}
			{...props}
		>
			<Icon name="x" className="size-4" aria-hidden="true" />
		</Ariakit.DialogDismiss>
	)
}
