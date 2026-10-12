import * as Ariakit from '@ariakit/react'
import { cloneElement, createElement, isValidElement } from 'react'
import { tw } from '~/ui/tw'
import { definitionMarkStyles } from './internal/definitionMark'

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
	/** Opens with no hover delay, for a value a reader scans across row by row (a table's weights and fill bars). */
	instant?: boolean
	/** Opens only while the anchor's one-line text is cut off, to show the full value; text that fits shows nothing. */
	onlyWhenClipped?: boolean
}

/* Tooltip — plain short text on hover, focus and tap, on the 6px tooltip surface. Ariakit links no description to the
   anchor (no `aria-describedby`), so screen readers do not announce the text: what they must hear goes in the anchor's
   name (`aria-label`, as QuestionHelper does) or in visible text. Structured or long content is a
   Hovercard (./Hovercard.tsx); content a reader acts on is a popover. Never put data in a native `title=`: it is
   unreachable on touch and unstyled. An icon-only control has an `aria-label` plus a Tooltip.

   Touch has no hover, so a tap opens the tooltip whatever element `render` makes the anchor, except an anchor that
   is, or sits inside, a link, button or other control, where the tap keeps that control's action.

   Focus opens it only when the reader moved focus there: Tab, or arrows, Home and End inside a composite (a
   SegmentedControl's radios). A control that code focused (a surface's first control on open, the lost-focus net,
   the trigger a closed menu or dialog hands focus back to) shows its tooltip only on hover or when tabbed to again;
   its name is still announced, so a screen reader hears what it is, and the next Escape closes the surface, not a
   tooltip.

   A control is the anchor: pass it as `render` (`render={<Button … />}`), never as a child of the default span, so
   the tap logic above sees it and keyboard focus on the control opens it (policy: check-focus-handoff). A definition of a
   control anchors on the control the same way, never on a focusable part inside it; in development the anchor
   reports one that takes focus inside another control (reportNestedTabStop), and tests fail on it.

   A definition on text (a label, a value, a heading) is a `Definition` (below), which owns its mark and tab stop. A
   control anchor keeps its own cursor and focus (policy: check-focus-handoff).

   Tooltip adds a tooltip, never a look. Its `className` reaches whichever element anchors it, the default span or the
   `render` element, and only places it and aligns what the trigger box holds (`gap-*`, `items-*`, `justify-*`;
   policy: check-part-classes). A button's look comes from the Button passed as
   `render` (an icon-only one is `variant="ghost" square`), a status dot is `StatusDot`, and colored text is a
   `Definition`.

   The default span is a trigger box (`flex shrink-0 items-center`): it centers an icon beside its text and a long
   sibling never squeezes it, so its `className` only places it (ms-auto, w-fit); classes that shrink, truncate or
   change its display belong on a `render` anchor (policy: check-focus-handoff). A `render` anchor keeps only its own
   classes and lays out as it would without the Tooltip. No anchor clips, because `overflow: hidden` cuts a control's 44px `touch-target` area. Text that should
   ellipsize: a `render` anchor takes `min-w-0 truncate` itself; in the default span, which is a flex box where
   `text-overflow` draws no ellipsis, wrap the text in `<span className="truncate">` and limit the span's width. A
   one-line cell that shows its full value only while it is cut off passes `onlyWhenClipped` with a `render` span that
   takes `block max-w-full truncate`. */

/* The tooltip surface: a hovercard's chrome with a 6px radius for a one-line bubble, not the popover 12px. It sets
   text-primary, so a tooltip rendered in place (portal={false}) never takes its anchor's color, such as a toast's
   red title. */
const surfaceStyles = tw`z-50 max-h-[calc(100dvh-80px)] translate-y-1 overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-medium bg-overlay body-sm text-primary opacity-0 shadow-overlay transition-[opacity,translate] duration-120 ease-out-quart data-enter:translate-y-0 data-enter:opacity-100 data-leave:duration-100 lg:max-h-(--popover-available-height)`

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

const isClipped = (element: HTMLElement) => element.scrollWidth > element.clientWidth

/* The keys a reader moves focus with: Tab, and a composite's arrows, Home, End and pages (a SegmentedControl's
   radios, a menu's rows). */
const READER_FOCUS_KEYS = new Set([
	'Tab',
	'ArrowUp',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
	'Home',
	'End',
	'PageUp',
	'PageDown'
])

/* Ariakit opens a tooltip on any focus that follows a key press, so a surface's autofocus, the lost-focus net
   (./focus.ts) or a focus return after Enter or Escape would open one, and the open tooltip would take the next
   Escape. One listener for the page records whether the focus that just moved followed one of those keys; any
   other focus, by code or after another key, leaves the tooltip closed. */
let readerKeyDown = false
let readerFocused: EventTarget | null = null
if (typeof document !== 'undefined') {
	document.addEventListener('keydown', (event) => (readerKeyDown = READER_FOCUS_KEYS.has(event.key)), true)
	document.addEventListener('pointerdown', () => (readerKeyDown = false), true)
	document.addEventListener(
		'focusin',
		(event) => {
			readerFocused = readerKeyDown ? event.target : null
			readerKeyDown = false
		},
		true
	)
}

const triggerBoxStyles = 'flex shrink-0 items-center'

export function Tooltip({
	content,
	children,
	placement = 'top-start',
	className,
	portal = true,
	instant,
	onlyWhenClipped,
	...props
}: ITooltip) {
	const store = Ariakit.useTooltipStore({ placement, showTimeout: instant ? 0 : undefined })

	// Without content there is no tooltip, but a `render` anchor is still the control: keep it.
	if (!content) return isValidElement(props.render) ? cloneElement(props.render, undefined, children) : <>{children}</>

	return (
		<Ariakit.TooltipProvider store={store}>
			<Ariakit.TooltipAnchor
				store={store}
				className={props.render ? className : `${triggerBoxStyles} ${className ?? ''}`}
				render={<span />}
				// Touch has no hover, so a tap opens the tooltip. A `render` anchor that is, or sits in, a
				// control leaves the tap to that control; plain anchors keep toggling as they always have.
				onTouchStart={(event) => {
					if (props.render && event.currentTarget.closest(TAP_ACTION_SELECTOR)) return
					if (onlyWhenClipped && !isClipped(event.currentTarget)) return
					store.toggle()
				}}
				showOnHover={onlyWhenClipped ? (event) => isClipped(event.currentTarget) : undefined}
				onFocusVisible={(event) => {
					// Never preventDefault here: Ariakit would also skip the anchor's focus-visible state, so the
					// focus ring would vanish and a menu button would stop opening on ArrowDown. Ariakit shows the
					// tooltip right after this handler; close it in the same task, before the browser paints.
					if (event.currentTarget !== readerFocused) queueMicrotask(store.hide)
				}}
				onMouseLeave={store.hide}
				ref={reportNestedTabStop}
				{...props}
			>
				{children}
			</Ariakit.TooltipAnchor>
			<Ariakit.Tooltip
				store={store}
				className={`${surfaceStyles} max-w-56 whitespace-pre-wrap data-[fullwidth=true]:max-w-(--popover-available-width)`}
				unmountOnHide
				portal={portal}
				data-fullwidth={props['data-fullwidth']}
			>
				<div className="p-2">{content}</div>
			</Ariakit.Tooltip>
		</Ariakit.TooltipProvider>
	)
}

/* Definition — text that explains itself on hover, focus and tap: a label, a value or a heading with a dotted
   underline. It owns the whole mark: the dotted underline 2px under the text (inside a one-line box, so truncating
   text keeps it), the help cursor, and the tab stop that lets a keyboard reader open it. It is never a button, which
   announces an action that does not exist and keeps a tap from opening the tooltip.

   Without `as` the anchor is Tooltip's trigger box, a flex span that places itself in a cell (`justify-end`,
   `ms-auto w-fit`); `as` renders the text as the element it already is: an inline `span` inside a sentence or a
   truncating label, a heading, a `dt`. `className` styles that text (type, color, placement), since the definition
   is the text and holds no other element. With no `content` the text renders without the mark or the tab stop, so a
   label whose definition is optional stays one call.

   Only text: a control explains itself with a `Tooltip` anchored on the control, a "?" beside a label is a
   `QuestionHelper`, and text whose explanation is structured (a breakdown, a list) is a `Hovercard` with
   `definition`, which draws the same mark. A part of the anchor that the underline should skip (a gap
   or a change beside the value) sits beside the Definition, not inside it. */
export function Definition({
	content,
	children,
	as,
	className,
	tabIndex = 0
}: {
	content: React.ReactNode
	children: React.ReactNode
	as?: 'span' | 'h1' | 'h2' | 'h3' | 'dt'
	className?: string
	/** -1 only for a copy of a definition that is focusable elsewhere, such as a sticky table header's mirror. */
	tabIndex?: 0 | -1
}) {
	if (!content) {
		return createElement(
			as ?? 'span',
			{ className: as ? className : `${triggerBoxStyles} ${className ?? ''}` },
			children
		)
	}
	return (
		<Tooltip
			content={content}
			tabIndex={tabIndex}
			className={`${definitionMarkStyles} ${className ?? ''}`}
			{...(as ? { render: createElement(as) } : {})}
		>
			{children}
		</Tooltip>
	)
}
