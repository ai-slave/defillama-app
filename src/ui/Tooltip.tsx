import * as Ariakit from '@ariakit/react'
import { cloneElement, isValidElement } from 'react'
import { tooltipSurfaceStyles } from '~/ui/Popover'

interface ITooltip extends Ariakit.TooltipOptions {
	content: string | null | React.ReactNode
	'data-fullwidth'?: boolean
	onClick?: (e: React.MouseEvent) => void
	children: React.ReactNode
	className?: string
	tabIndex?: number
	placement?: Ariakit.TooltipProviderProps['placement']
	/** false renders the tooltip in place, for an anchor inside a layer stacked above the z-50 portal (a toast). */
	portal?: boolean
}

/* Tooltip — plain short text on hover, focus and tap, on the 6px tooltip surface. Structured or long content is a
   Hovercard (./Hovercard.tsx); content a reader acts on is a popover. Never put data in a native `title=`: it is
   unreachable on touch and unstyled. An icon-only control has an `aria-label` plus a Tooltip.

   Touch has no hover, so a tap opens the tooltip whatever element `render` makes the anchor, except an anchor that
   is, or sits inside, a link, button or other control, where the tap keeps that control's action.

   A control is the anchor: pass it as `render` (`render={<Button … />}`), never as a child of the default span, so
   the tap logic above sees it and `aria-describedby` lands on it (policy: check-focus-handoff).

   The default span is a trigger box (`flex shrink-0 items-center`): it centers an icon beside its text and a long
   sibling never squeezes it, so its `className` only places it (ms-auto, w-fit); classes that shrink, truncate or
   change its display belong on a `render` anchor (policy: check-focus-handoff). A `render` anchor keeps only its own
   classes and lays out as it would without the Tooltip. No anchor clips, because `overflow: hidden` cuts a control's 44px `touch-target` area. Text that should
   ellipsize: a `render` anchor takes `min-w-0 truncate` itself; in the default span, which is a flex box where
   `text-overflow` draws no ellipsis, wrap the text in `<span className="truncate">` and limit the span's width. */

/** Elements whose tap already does something, such as a link or button: a tap there keeps that action instead of opening the tooltip. */
const TAP_ACTION_SELECTOR =
	'a[href], button, summary, input, select, textarea, label, [contenteditable="true"], [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="option"]'

export function Tooltip({ content, children, placement = 'top-start', className, portal = true, ...props }: ITooltip) {
	const store = Ariakit.useTooltipStore({ placement })

	// Without content there is no tooltip, but a `render` anchor is still the control: keep it.
	if (!content) return isValidElement(props.render) ? cloneElement(props.render, undefined, children) : <>{children}</>

	return (
		<Ariakit.TooltipProvider store={store}>
			<Ariakit.TooltipAnchor
				store={store}
				className={props.render ? className : `flex shrink-0 items-center ${className ?? ''}`}
				render={<span />}
				// Touch has no hover, so a tap opens the tooltip. A `render` anchor that is, or sits in, a
				// control leaves the tap to that control; plain anchors keep toggling as they always have.
				onTouchStart={(event) => {
					if (props.render && event.currentTarget.closest(TAP_ACTION_SELECTOR)) return
					store.toggle()
				}}
				onMouseLeave={store.hide}
				{...props}
			>
				{children}
			</Ariakit.TooltipAnchor>
			<Ariakit.Tooltip
				store={store}
				className={`${tooltipSurfaceStyles} max-w-56 whitespace-pre-wrap data-[fullwidth=true]:max-w-(--popover-available-width)`}
				unmountOnHide
				portal={portal}
				data-fullwidth={props['data-fullwidth']}
			>
				<div className="p-2">{content}</div>
			</Ariakit.Tooltip>
		</Ariakit.TooltipProvider>
	)
}
