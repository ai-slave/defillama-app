import * as Ariakit from '@ariakit/react'
import { popoverHovercardSurfaceStyles } from '~/ui/Popover'

interface IHovercard {
	content: React.ReactNode
	children: React.ReactNode
	/** Anchor layout classes; the anchor renders as a span unless `render` is given.
	    The anchor is inline-flex so it sizes to its content and follows the parent's
	    text-align, like a table cell's `align`. Do not pass another display class:
	    `inline-flex` sorts after `flex`, `block` and `inline-block`, so it always wins. */
	className?: string
	/** Custom anchor element, e.g. render={<button onClick={...} />}. */
	render?: React.ReactElement
	placement?: Ariakit.HovercardProviderProps['placement']
	/** Classes for the card body; defaults to p-3. */
	contentClassName?: string
	/** Tap/click on the anchor also opens the card (the touch path). Turn off
	    ONLY when the anchor has its own click action (e.g. a real button). */
	showOnClick?: boolean
	/** Called each time the card opens, whether by hover, focus or tap. */
	onOpen?: () => void
}

// A side card tries the other side, then below and above, before squeezing into a narrow viewport.
const SIDE_FALLBACKS: Record<string, string> = {
	right: 'left-start bottom-start top-start',
	left: 'right-start bottom-start top-start'
}

/**
 * Hover/focus card for structured or long content (lists, breakdowns, definitions, previews). Unlike a text
 * `<Tooltip>` it can be hovered into, dismissed with Escape, and reached by keyboard via the built-in
 * HovercardDisclosure. The anchor also opens on tap/click unless `showOnClick={false}`, so the content stays
 * reachable on touch.
 *
 * Which surface: plain short text is a `<Tooltip>`. When opening the surface is the primary action, or the content
 * is a form or control set, use a popover, menu or dialog. A preview here may hold a few links or actions while
 * keyboard and touch access stay intact. When the anchor has its own click action, keep it and add a separate
 * labeled info control. The "N chains" list is the shared `ProtocolChainsHovercard`.
 *
 * Anchor: inline-flex, so it sizes to its content and follows the parent's `text-align`. Put truncating text in an
 * inner `<span className="truncate">` with `max-w-full` on the anchor; a bar that fills its cell adds `w-full`; an
 * anchor with no text (a pie, a bar) adds `align-middle` so it leaves the text baseline. In a `flex-col` parent the
 * anchor stretches to the column's width, and a side card opens past the widest sibling; add `self-start`.
 *
 * Placement: an anchor in a table cell opens to the side (`right-start`, or `left-start` near the table's end). A card
 * above or below covers the neighboring row, and Ariakit keeps it open while the pointer moves toward it, so it
 * swallows the click on that row. A side card that has no room falls back below.
 *
 * Width: the surface caps itself with Ariakit's `--popover-available-width` and `--popover-available-height` and
 * keeps 16px from the viewport edges. The content owns its preferred width: `w-max` for compact vertical lists,
 * `w-80` for prose and ordinary cards, `w-96` for dense financial breakdowns, combined with
 * `max-w-(--popover-available-width)`. Long content scrolls inside the available height. Never reproduce anchored
 * safety with `calc(100vw - …)`.
 */
export function Hovercard({
	content,
	children,
	className,
	render,
	placement = 'top-start',
	contentClassName,
	showOnClick = true,
	onOpen
}: IHovercard) {
	const store = Ariakit.useHovercardStore({
		placement,
		timeout: 150,
		setOpen: (open) => {
			if (open) onOpen?.()
		}
	})

	if (!content) return <>{children}</>

	return (
		<Ariakit.HovercardProvider store={store}>
			<Ariakit.HovercardAnchor
				store={store}
				className={`inline-flex shrink-0 items-center ${className ?? ''}`}
				render={render ?? <span />}
				{...(showOnClick ? { onClick: () => store.show() } : {})}
			>
				{children}
			</Ariakit.HovercardAnchor>
			<Ariakit.HovercardDisclosure aria-label="Show details" />
			<Ariakit.Hovercard
				className={`${popoverHovercardSurfaceStyles} ${contentClassName ?? 'p-3'}`}
				gutter={6}
				overflowPadding={16}
				flip={SIDE_FALLBACKS[placement.split('-')[0]] ?? true}
				portal
				unmountOnHide
				hideOnInteractOutside
			>
				{content}
			</Ariakit.Hovercard>
		</Ariakit.HovercardProvider>
	)
}
