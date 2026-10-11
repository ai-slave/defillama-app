import * as Ariakit from '@ariakit/react'
import { cloneElement, isValidElement } from 'react'
import { tooltipSurfaceStyles } from '~/ui/Popover'

interface ITooltip extends Ariakit.TooltipOptions {
	content: string | null | React.ReactNode
	'data-fullwidth'?: boolean
	onClick?: (e: React.MouseEvent) => void
	/** Optional only for a `render` anchor with no content of its own, such as an input. */
	children?: React.ReactNode
	className?: string
	tabIndex?: number
	placement?: Ariakit.TooltipProviderProps['placement']
	/** false renders the tooltip in place, for an anchor inside a layer stacked above the z-50 portal (a toast). */
	portal?: boolean
}

/* Tooltip — plain short text on hover, focus and tap, on the 6px tooltip surface. Ariakit links no description to the
   anchor (no `aria-describedby`), so screen readers do not announce the text: what they must hear goes in the anchor's
   name (`aria-label`, as QuestionHelper does) or in visible text. Structured or long content is a
   Hovercard (./Hovercard.tsx); content a reader acts on is a popover. Never put data in a native `title=`: it is
   unreachable on touch and unstyled. An icon-only control has an `aria-label` plus a Tooltip.

   Touch has no hover, so a tap opens the tooltip whatever element `render` makes the anchor, except an anchor that
   is, or sits inside, a link, button or other control, where the tap keeps that control's action.

   A control is the anchor: pass it as `render` (`render={<Button … />}`), never as a child of the default span, so
   the tap logic above sees it and keyboard focus on the control opens it (policy: check-focus-handoff). A definition of a
   control anchors on the control the same way, never on a focusable part inside it; in development the anchor
   reports one that takes focus inside another control (reportNestedTabStop), and tests fail on it.

   A definition on text (a label, a value, a heading) has a dotted underline, and its anchor takes `cursor-help` and
   `tabIndex={0}`: Ariakit never makes an anchor focusable, so without the tab stop a keyboard reader cannot open the
   definition. The anchor stays a span or the element it already is (`h2`, `dt`), never a button, which announces an
   action that does not exist and keeps a tap from opening the tooltip. A control anchor keeps its own cursor and
   focus (policy: check-focus-handoff).

   The default span is a trigger box (`flex shrink-0 items-center`): it centers an icon beside its text and a long
   sibling never squeezes it, so its `className` only places it (ms-auto, w-fit); classes that shrink, truncate or
   change its display belong on a `render` anchor (policy: check-focus-handoff). A `render` anchor keeps only its own
   classes and lays out as it would without the Tooltip. No anchor clips, because `overflow: hidden` cuts a control's 44px `touch-target` area. Text that should
   ellipsize: a `render` anchor takes `min-w-0 truncate` itself; in the default span, which is a flex box where
   `text-overflow` draws no ellipsis, wrap the text in `<span className="truncate">` and limit the span's width. */

/** Elements whose tap already does something, such as a link or button: a tap there keeps that action instead of opening the tooltip. */
const TAP_ACTION_SELECTOR =
	'a[href], button, summary, input, select, textarea, label, [contenteditable="true"], [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="option"]'

/** Development check for an anchor that takes focus inside another control (a "?" in a toggle's label, a definition in
    a sort button): it is a second tab stop within the control, and a tap reaches only one of the two. The policy
    (check-focus-handoff) sees nesting written in one file; this sees nesting through props and child components.
    Tests fail on it (vitest.setup.ts). A radio inside its own label is one control, not a nesting. */
function reportNestedTabStop(anchor: HTMLElement | null) {
	if (process.env.NODE_ENV === 'production' || !anchor || anchor.tabIndex < 0) return
	const host = anchor.parentElement?.closest(TAP_ACTION_SELECTOR)
	if (!host || (host instanceof HTMLLabelElement && host.control === anchor)) return
	console.error(
		`Nested tab stop: a Tooltip anchor <${anchor.tagName.toLowerCase()}> takes focus inside <${host.tagName.toLowerCase()}>. Anchor the tooltip on that control instead (src/ui/Tooltip.tsx).`
	)
}

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
				ref={reportNestedTabStop}
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
